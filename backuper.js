const { spawn } = require("child_process");
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const args = process.argv.slice(2);
const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

let currentDump = null;
function backup() {
    let t0 = performance.now();
    return new Promise((resolve, reject) => {
        let fx = new Date().toISOString().replace(/[:.]/g, '-');
        let outputPath = path.join(__dirname, "/uploads/backups/");
        let backupName = `backup_${fx}.gz`;

        //verifico si existe la URI
        if (!process.env.MONGO_URI) return reject(new Error("MONGO_URI no definida"));

        //creo la carpeta si no existe
        fs.mkdirSync(outputPath, { recursive: true });

        const args = [
            `--uri=${process.env.MONGO_URI}`,
            `--archive=${path.join(outputPath, backupName)}`,
            "--gzip"
        ];

        const command = process.platform === "win32" ? `C:\\Program Files\\MongoDB\\tools\\mongodump.exe` : "mongodump";
        const dump = spawn(command, args, { stdio: "pipe" });
        currentDump = dump;

        dump.stderr.on("data", d => console.error(d.toString()));
        dump.stdout.on("data", d => console.log(d.toString()));

        dump.on("error", code=>{
            currentDump = null;
            reject(new Error(`mongodump error: ${code?.message}`));
        });

        dump.on("close", async code => {
            currentDump = null;
            if (code !== 0) return reject(new Error(`mongodump exit code ${code}`));

            try {
                await subirBackupR2(outputPath, backupName);
                limpiarBackupsLocales(outputPath, 5);
                let t1 = performance.now();
                console.log(`Backup OK en ${(t1 - t0).toFixed(2)} ms`);
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    });
}

async function subirBackupR2(outputPath, zipName) {
    try{
        const stream = fs.createReadStream(path.join(outputPath, zipName));
    
        const key = `respaldos/${zipName}`;
    
        await r2.send(
            new PutObjectCommand({
                Bucket: process.env.R2_BACKUP_BUCKET,
                Key: zipName,
                Body: stream,
                ContentType: "application/zip",
            })
        );
        console.log("Backup uploaded to R2 with key:", key);
        
        // Elimino los backups viejos
        await eliminarViejosBackupsR2();

        
        return key;
    }catch(err){
        console.error("Error uploading backup to R2:", err);
    }
}

async function eliminarViejosBackupsR2(retentionDays=10) {
    const list = await r2.send(
        new ListObjectsV2Command({
            Bucket: process.env.R2_BACKUP_BUCKET,
        })
    );
    if (!list.Contents || list.Contents.length <= retentionDays) return;

    // ordenar del más nuevo al más viejo
    const ordenados = list.Contents.sort(
        (a, b) => new Date(b.LastModified) - new Date(a.LastModified)
    );

    //
    const aBorrar = ordenados.slice(retentionDays);

    for (const obj of aBorrar) {
        //console.log("Eliminando backup viejo de R2:", obj.Key);
        await r2.send(
            new DeleteObjectCommand({
                Bucket: process.env.R2_BACKUP_BUCKET,
                Key: obj.Key,
            })
        );
    }
}

async function limpiarBackupsLocales(outputPath, maxBackups=5) {
    const files = fs.readdirSync(outputPath)
        .filter(f => f.startsWith("backup_") && f.endsWith(".gz"))
        .map(f => ({
            name: f,
            time: fs.statSync(path.join(outputPath, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
    if (files.length <= maxBackups) return;

    const aBorrar = files.slice(maxBackups);
    for (const file of aBorrar) {
        //console.log("Eliminando backup local viejo:", file.name);
        fs.unlinkSync(path.join(outputPath, file.name));
    }
}


// Programo un backup a las 4am todos los dias
let running = false;
cron.schedule("0 4 * * *", async () => {
    try {
        if(running) return;
        running = true;

        console.log("Comenzando backup...");
        await Promise.race([
            backup(),
            new Promise((_, reject) =>
                setTimeout(
                    () => {
                        if(currentDump) currentDump.kill(); //si esta corriendo mato el proceso
                        reject(new Error("Backup timeout (10min)"))
                    },
                    10 * 60 * 1000
                )
            )
        ]);
    } catch (error) {
        console.error("Error al generar backup:", error);
    } finally {
        running = false;
    }
}, {
    scheduled: true,
    timezone: "America/Argentina/Buenos_Aires"
});

if(args.includes("--now")){
    console.log("Iniciando backup inmediato...");
    backup().then(()=>{
        console.log("Backup inmediato finalizado.");
        process.exit(0);
    }).catch(err=>{
        console.error("Error en backup inmediato:", err);
        process.exit(1);
    });
}