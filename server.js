const express = require('express');
const multer = require('multer');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const port = 3000;

// 获取本机IP地址
const os = require('os');
const networkInterfaces = os.networkInterfaces();
let serverIP = 'localhost';
for (const interfaceName in networkInterfaces) {
    const interface = networkInterfaces[interfaceName];
    for (const entry of interface) {
        if (entry.family === 'IPv4' && !entry.internal) {
            serverIP = entry.address;
            break;
        }
    }
    if (serverIP !== 'localhost') break;
}

// 创建固件存储目录
const firmwareDir = path.join(__dirname, 'firmware');
if (!fs.existsSync(firmwareDir)) {
    fs.mkdirSync(firmwareDir);
}

// 配置文件存储
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, firmwareDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// 中间件
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(session({
    secret: 'firmware-server-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// 验证密码中间件
const authMiddleware = (req, res, next) => {
    if (req.session.authenticated || req.path === '/auth' || req.path === '/check-auth') {
        next();
    } else {
        res.status(401).json({ error: '未授权访问' });
    }
};

// 应用验证中间件到所有API路由
app.use('/upload', authMiddleware);
app.use('/list', authMiddleware);
app.use('/firmware', authMiddleware);

// 验证密码
app.post('/auth', (req, res) => {
    const { password } = req.body;
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    
    if (password === config.password) {
        req.session.authenticated = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: '密码错误' });
    }
});

// 检查认证状态
app.get('/check-auth', (req, res) => {
    res.json({ authenticated: !!req.session.authenticated });
});

// 静态文件服务
app.use('/firmware', express.static(firmwareDir));
app.use(express.static('public'));

// 读取版本信息
function readVersions() {
    const versionsPath = path.join(firmwareDir, 'versions.json');
    if (!fs.existsSync(versionsPath)) {
        return { versions: {} };
    }
    return JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
}

// 保存版本信息
function saveVersions(versions) {
    const versionsPath = path.join(firmwareDir, 'versions.json');
    fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2));
}

// 上传固件
app.post('/upload', upload.single('firmware'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '没有上传文件' });
    }

    // 检查文件类型
    if (!req.file.originalname.endsWith('.bin')) {
        fs.unlinkSync(req.file.path); // 删除非.bin文件
        return res.status(400).json({ error: '只允许上传.bin文件' });
    }

    const version = req.body.version || '1.0.0';
    // 验证版本号格式
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(version)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: '版本号格式无效，请使用x.x.x格式' });
    }

    const description = req.body.description || '';
    const uploadTime = new Date().toISOString();
    
    const versions = readVersions();
    versions.versions[req.file.filename] = {
        version: version,
        description: description,
        uploadTime: uploadTime
    };
    saveVersions(versions);

    res.json({
        message: '固件上传成功',
        filename: req.file.filename,
        version: version,
        description: description,
        uploadTime: uploadTime
    });
});

// 获取固件列表
app.get('/list', (req, res) => {
    fs.readdir(firmwareDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: '读取固件目录失败' });
        }

        const versions = readVersions();
        res.json({
            files: files.filter(file => file !== 'versions.json').map(file => ({
                name: file,
                url: `/firmware/${file}`,
                fullUrl: `http://${serverIP}:${port}/firmware/${file}`,
                size: fs.statSync(path.join(firmwareDir, file)).size,
                version: versions.versions[file]?.version || '未知',
                uploadTime: versions.versions[file]?.uploadTime || null
            }))
        });
    });
});

// 更新固件信息
app.post('/firmware/:filename/update', (req, res) => {
    const { filename } = req.params;
    const { version, newFilename } = req.body;

    if (!version) {
        return res.status(400).json({ error: '版本号不能为空' });
    }

    const filepath = path.join(firmwareDir, filename);
    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: '文件不存在' });
    }

    const versions = readVersions();
    
    if (newFilename && newFilename !== filename) {
        const newFilepath = path.join(firmwareDir, newFilename);
        if (fs.existsSync(newFilepath)) {
            return res.status(400).json({ error: '新文件名已存在' });
        }
        
        try {
            fs.renameSync(filepath, newFilepath);
            const fileInfo = versions.versions[filename];
            delete versions.versions[filename];
            versions.versions[newFilename] = {
                ...fileInfo,
                version: version
            };
        } catch (error) {
            return res.status(500).json({ error: '重命名文件失败' });
        }
    } else {
        versions.versions[filename].version = version;
    }

    saveVersions(versions);

    res.json({
        message: '固件信息更新成功',
        filename: newFilename || filename,
        version
    });
});

// 获取固件版本
app.get('/firmware/:filename/version', (req, res) => {
    const filename = req.params.filename;
    const versions = readVersions();

    if (!versions.versions[filename]) {
        return res.status(404).json({ error: '固件不存在或未记录版本信息' });
    }

    res.json({
        filename: filename,
        version: versions.versions[filename].version,
        uploadTime: versions.versions[filename].uploadTime
    });
});

// 删除固件
app.delete('/firmware/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(firmwareDir, filename);

    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: '文件不存在' });
    }

    fs.unlink(filepath, (err) => {
        if (err) {
            return res.status(500).json({ error: '删除文件失败' });
        }

        // 删除版本信息
        const versions = readVersions();
        delete versions.versions[filename];
        saveVersions(versions);

        res.json({ message: '文件删除成功' });
    });
});

// 启动服务器
app.listen(port, '0.0.0.0', () => {
    console.log(`固件托管服务器运行在 http://${serverIP}:${port}`);
    console.log(`固件存储目录: ${firmwareDir}`);
});