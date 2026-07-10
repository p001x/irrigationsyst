const fs = require('fs');
const path = require('path');

const token = process.env.GITHUB_TOKEN; // Set via Replit Secrets
const owner = "peterson1223";
const repo = "projectAGRIADAPT";

const filesToUpload = [
    "index.html",
    "style.css",
    "script.js",
    "healthy_maize_rwanda_1775826339710.png",
    "stressed_maize_rwanda_1775826357787.png",
    "nasho_center_pivot_irrigation_rwanda_1775829944977.png"
];

async function uploadFile(fileName) {
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${fileName} - not found.`);
        return;
    }

    const content = fs.readFileSync(filePath).toString('base64');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`;

    // check if file exists to get SHA (for updating)
    let sha = undefined;
    try {
        const getRes = await fetch(url, { headers: { "Authorization": `token ${token}` } });
        if (getRes.status === 200) {
            const data = await getRes.json();
            sha = data.sha;
        }
    } catch(e) {}

    const body = {
        message: `Add/Update ${fileName}`,
        content: content,
        branch: "main"
    };
    if (sha) body.sha = sha;

    console.log(`Uploading ${fileName}...`);
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            "Authorization": `token ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "AgriAdapt-Deploy-Script"
        },
        body: JSON.stringify(body)
    });

    if (res.status === 201 || res.status === 200) {
        console.log(`✅ Success: ${fileName}`);
    } else {
        console.error(`❌ Failed: ${fileName} - ${res.statusText}`);
        const text = await res.text();
        console.error(text);
    }
}

async function run() {
    console.log("Starting automatic deployment to GitHub via API...");
    for (const f of filesToUpload) {
        await uploadFile(f);
    }
    console.log("All uploads finished!");
}

run();
