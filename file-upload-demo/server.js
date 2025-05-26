const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const app = express();
const port = 3000;
const cors = require("cors");

// 配置 CORS
app.use(cors());

// 配置 multer 处理文件上传
const upload = multer({
  storage: multer.memoryStorage(), // 使用内存存储进行临时文件存储
});

// 创建上传和临时文件夹
const uploadDir = path.join(__dirname, "uploads");
const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// 处理切片上传
app.post("/upload-chunk", upload.single("file"), (req, res) => {
  try {
    const file = req.file;
    // 检查 req.body 是否存在
    if (!req.body) {
      return res.status(400).send("请求体为空");
    }
    const { chunkIndex, totalChunks, fileHash } = req.body;
    const chunkDir = path.join(tempDir, fileHash);

    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir);
    }

    const chunkPath = path.join(chunkDir, `${chunkIndex}`);
    fs.writeFileSync(chunkPath, file.buffer);

    res.send("切片上传成功");
  } catch (error) {
    console.error(error);
    res.status(500).send("切片保存失败");
  }
});

// 合并切片
app.post("/merge-chunks", upload.none(), (req, res) => {
  try {
    const { fileHash, fileName, totalChunks } = req.body;
    // 检查必要参数是否存在
    if (!fileHash || !fileName || !totalChunks) {
      return res.status(400).send("缺少必要参数");
    }
    const chunkDir = path.join(tempDir, fileHash);
    const filePath = path.join(uploadDir, fileName);
    const writeStream = fs.createWriteStream(filePath);

    let chunksProcessed = 0;

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `${i}`);
      if (!fs.existsSync(chunkPath)) {
        console.error(`切片 ${i} 不存在: ${chunkPath}`);
        return res.status(500).send(`切片 ${i} 不存在`);
      }
      const readStream = fs.createReadStream(chunkPath);
      readStream.pipe(writeStream, { end: false });

      readStream.on("error", (error) => {
        console.error(`读取切片 ${i} 出错:`, error);
        writeStream.destroy();
        res.status(500).send(`读取切片 ${i} 出错`);
      });

      readStream.on("end", () => {
        fs.unlinkSync(chunkPath);
        chunksProcessed++;
        if (chunksProcessed === totalChunks) {
          writeStream.end();
        }
      });
    }

    writeStream.on("close", () => {
      fs.rmdirSync(chunkDir);
      res.send("文件合并成功");
    });

    writeStream.on("error", (error) => {
      console.error("写入文件出错:", error);
      res.status(500).send("写入文件出错");
    });
  } catch (error) {
    console.error("合并切片时出错:", error);
    res.status(500).send("合并切片时出错");
  }
});

// 检查已上传的切片
app.get("/check-chunks", (req, res) => {
  const { fileHash } = req.query;
  const chunkDir = path.join(tempDir, fileHash);
  const uploadedChunks = [];

  if (fs.existsSync(chunkDir)) {
    const files = fs.readdirSync(chunkDir);
    files.forEach((file) => {
      uploadedChunks.push(parseInt(file));
    });
  }

  res.json({ uploadedChunks });
});

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});
