/**
 * LOCAL COMPANION SERVER (Save as index.js on your device / Termux)
 * High-performance, zero-dependency recursive file bundling for AI Game Companion Context.
 * Modernized with security sandboxing, performance folder exclusion, and live health metrics.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// Configurable watch directory and port via Environment Variables (crucial for local Termux custom paths)
const TARGET_DIR = process.env.TARGET_DIR || "/storage/emulated/0/Download/10068-FILES/";
const PORT = process.env.PORT || 3000;

// Set of directories to strictly ignore during recursive scanning to prevent out-of-memory errors
const EXCLUDED_NAMES = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    '.github',
    '.vscode',
    'tmp',
    '.DS_Store'
]);

// Enable CORS and JSON parsing with adequate limit for larger codebase files
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

/**
 * Recursively scans target directory for files and folders.
 * Features an ignore mechanism to avoid infinite loops, huge node_modules, or binary assets.
 */
function scanDirectory(dir, baseDir = TARGET_DIR) {
    let files = [];
    let folders = [];

    try {
        if (!fs.existsSync(dir)) return { files, folders };
        const items = fs.readdirSync(dir);

        for (const item of items) {
            // High-Performance Exclusions
            if (EXCLUDED_NAMES.has(item)) continue;

            const fullPath = path.join(dir, item);
            const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            const stat = fs.lstatSync(fullPath);

            if (stat.isDirectory()) {
                folders.push({
                    name: item,
                    relativePath: relativePath
                });
                const sub = scanDirectory(fullPath, baseDir);
                files = files.concat(sub.files);
                folders = folders.concat(sub.folders);
            } else if (stat.isFile()) {
                files.push({
                    name: item,
                    relativePath: relativePath,
                    path: fullPath
                });
            }
        }
    } catch (err) {
        console.error(`[COMPANION] Error scanning ${dir}:`, err.message);
    }
    return { files, folders };
}

/**
 * Builds standard layout visualizer tree string for Gemini codebase insight
 */
function buildTreeString(files, folders) {
    let tree = "WORKSPACE STRUCTURE:\n";
    const allPaths = [
        ...folders.map(f => f.relativePath + "/"),
        ...files.map(f => f.relativePath)
    ].sort();

    allPaths.forEach(p => {
        const depth = p.split('/').length;
        tree += "  ".repeat(depth - 1) + "|-- " + p + "\n";
    });
    return tree;
}

// Lightweight Health Ping Endpoint for the React User Interface
app.get('/api/health', (req, res) => {
    try {
        const hasWriteAccess = (() => {
            try {
                if (!fs.existsSync(TARGET_DIR)) {
                    fs.mkdirSync(TARGET_DIR, { recursive: true });
                }
                const testFile = path.join(TARGET_DIR, '.codex_write_test');
                fs.writeFileSync(testFile, 'ok', 'utf8');
                fs.unlinkSync(testFile);
                return true;
            } catch (err) {
                return false;
            }
        })();

        res.json({
            status: "ok",
            uptime: process.uptime(),
            path: TARGET_DIR,
            writeAccess: hasWriteAccess,
            apiVersion: "1.2.0"
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Fetch folder lists and files metainfo
app.get('/api/files', (req, res) => {
    try {
        const { files, folders } = scanDirectory(TARGET_DIR);
        res.json({ files, folders, path: TARGET_DIR });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// Content packager (replaces raw multiple file lookups with optimized bundle ingest)
app.get('/api/bundle', (req, res) => {
    try {
        if (!fs.existsSync(TARGET_DIR)) {
            return res.json({ bundle: "", count: 0, path: TARGET_DIR, fileNames: [], folders: [] });
        }
        
        const { files, folders } = scanDirectory(TARGET_DIR);
        let bundle = "DIRECTORY STRUCTURE:\n" + buildTreeString(files, folders) + "\n\n";
        let count = 0;
        let fileNames = [];
        const MAX_BUNDLE_CHARS = 1000000; // Cap to 1M chars (~400k token margin safety)

        for (const file of files) {
            const ext = path.extname(file.name).toLowerCase();
            // Bundling only source materials to save token headroom
            if (['.lua', '.txt', '.json', '.md', '.cfg', '.ini', '.yaml', '.yml'].includes(ext)) {
                if (bundle.length > MAX_BUNDLE_CHARS) {
                    bundle += `\n\n[!!! CONTEXT TRUNCATED: Reached limit of ${MAX_BUNDLE_CHARS} characters !!!]\n`;
                    break;
                }
                const content = fs.readFileSync(file.path, 'utf8');
                bundle += `\n--- FILE: ${file.relativePath} ---\n${content}\n`;
                count++;
                fileNames.push(file.relativePath);
            }
        }
        res.json({ bundle, count, path: TARGET_DIR, fileNames, folders });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// Single file preview stream
app.get('/api/file-content', (req, res) => {
    const relativePath = req.query.name;
    if (!relativePath) return res.status(400).send("Parameter 'name' required");

    const filePath = path.join(TARGET_DIR, relativePath);
    const resolvedPath = path.resolve(filePath);
    const resolvedTargetDir = path.resolve(TARGET_DIR);

    // Guard against directory traversal attacks
    if (!resolvedPath.startsWith(resolvedTargetDir)) {
        return res.status(403).send("Access Denied: Path escapes watched folder");
    }

    try {
        if (!fs.existsSync(filePath)) return res.status(404).send("File not found");
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(fs.readFileSync(filePath, "utf-8"));
    } catch (e) { 
        res.status(500).send(e.message); 
    }
});

// Save or Create a File (Codex XML Action backend handler)
app.post('/api/save-file', (req, res) => {
    try {
        const { name, content } = req.body;
        if (!name) return res.status(400).json({ error: "Missing file name" });

        const filePath = path.join(TARGET_DIR, name);
        const resolvedPath = path.resolve(filePath);
        const resolvedTargetDir = path.resolve(TARGET_DIR);

        // Security traversal bypass prevention check
        if (!resolvedPath.startsWith(resolvedTargetDir)) {
            return res.status(403).json({ error: "Access denied: outside watch directory boundaries" });
        }

        // Ensure parent nested directories exist
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, content || "", 'utf8');
        console.log(`[COMPANION] Saved script: ${name} (${(content || "").length} chars)`);
        res.json({ success: true, path: name });
    } catch (e) {
        console.error(`[COMPANION] Error saving ${req.body?.name}:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// Delete a File (Codex XML Delete action handler)
app.post('/api/delete-file', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Missing file name" });

        const filePath = path.join(TARGET_DIR, name);
        const resolvedPath = path.resolve(filePath);
        const resolvedTargetDir = path.resolve(TARGET_DIR);

        // Security traversal bypass prevention check
        if (!resolvedPath.startsWith(resolvedTargetDir)) {
            return res.status(403).json({ error: "Access denied: outside watch directory boundaries" });
        }

        if (fs.existsSync(filePath)) {
            const stat = fs.lstatSync(filePath);
            if (stat.isFile()) {
                fs.unlinkSync(filePath);
                console.log(`[COMPANION] Deleted script: ${name}`);
                res.json({ success: true, deleted: true, path: name });
            } else {
                res.status(400).json({ error: "Target path refers to a folder - directories cannot be deleted directly" });
            }
        } else {
            res.json({ success: true, deleted: false, note: "Target file already did not exist" });
        }
    } catch (e) {
        console.error(`[COMPANION] Error deleting ${req.body?.name}:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// Launch server reporting setup status
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 CODE CODEX COMPANION SERVER INITIALIZED`);
    console.log(`🌐 Endpoint Url: http://localhost:${PORT}`);
    console.log(`📂 Watched Code: ${TARGET_DIR}`);
    console.log(`⚡ Performance File Exclusions Loaded`);
    console.log(`======================================================\n`);
});
