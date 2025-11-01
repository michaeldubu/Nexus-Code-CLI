
// src/utils/fsOperations.ts
import * as fs from "fs";
import { stat as statPromise } from "fs/promises";
var NodeFsOperations = {
  accessSync(fsPath, mode) {
    fs.accessSync(fsPath, mode);
  },
  cwd() {
    return process.cwd();
  },
  chmodSync(fsPath, mode) {
    fs.chmodSync(fsPath, mode);
  },
  existsSync(fsPath) {
    return fs.existsSync(fsPath);
  },
  async stat(fsPath) {
    return statPromise(fsPath);
  },
  statSync(fsPath) {
    return fs.statSync(fsPath);
  },
  readFileSync(fsPath, options) {
    return fs.readFileSync(fsPath, { encoding: options.encoding });
  },
  readFileBytesSync(fsPath) {
    return fs.readFileSync(fsPath);
  },
  readSync(fsPath, options) {
    let fd = undefined;
    try {
      fd = fs.openSync(fsPath, "r");
      const buffer = Buffer.alloc(options.length);
      const bytesRead = fs.readSync(fd, buffer, 0, options.length, 0);
      return { buffer, bytesRead };
    } finally {
      if (fd)
        fs.closeSync(fd);
    }
  },
  writeFileSync(fsPath, data, options) {
    if (!options.flush) {
      const writeOptions = {
        encoding: options.encoding
      };
      if (options.mode !== undefined) {
        writeOptions.mode = options.mode;
      }
      fs.writeFileSync(fsPath, data, writeOptions);
      return;
    }
    let fd;
    try {
      const mode = options.mode !== undefined ? options.mode : undefined;
      fd = fs.openSync(fsPath, "w", mode);
      fs.writeFileSync(fd, data, { encoding: options.encoding });
      fs.fsyncSync(fd);
    } finally {
      if (fd) {
        fs.closeSync(fd);
      }
    }
  },
  appendFileSync(path, data) {
    fs.appendFileSync(path, data);
  },
  copyFileSync(src, dest) {
    fs.copyFileSync(src, dest);
  },
  unlinkSync(path) {
    fs.unlinkSync(path);
  },
  renameSync(oldPath, newPath) {
    fs.renameSync(oldPath, newPath);
  },
  linkSync(target, path) {
    fs.linkSync(target, path);
  },
  symlinkSync(target, path) {
    fs.symlinkSync(target, path);
  },
  readlinkSync(path) {
    return fs.readlinkSync(path);
  },
  realpathSync(path) {
    return fs.realpathSync(path);
  },
  mkdirSync(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true, mode: 448 });
    }
  },
  readdirSync(dirPath) {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  },
  readdirStringSync(dirPath) {
    return fs.readdirSync(dirPath);
  },
  isDirEmptySync(dirPath) {
    const files = this.readdirSync(dirPath);
    return files.length === 0;
  },
  rmdirSync(dirPath) {
    fs.rmdirSync(dirPath);
  },
  rmSync(path, options) {
    fs.rmSync(path, options);
  },
  createWriteStream(path) {
    return fs.createWriteStream(path);
  }
};
var activeFs = NodeFsOperations;
function getFsImplementation() {
  return activeFs;
}
