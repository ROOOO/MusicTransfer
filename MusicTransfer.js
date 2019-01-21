const fs = require('fs');
const md5File = require('md5-file');
const path = require('path');
const exec = require('child_process').execSync;

const useMd5 = false;

var LocalPath = '/Users/king/Music/网易云音乐';
var PlayerPath = '/Volumes/WALKMAN/MUSIC';
var localFiles = {};
var playerFiles = {};

function convertNcm(pathName) {
  console.log('converting ncm...');
  return new Promise((resolve) => {
    fs.readdir(pathName, {withFileTypes: true}, (err, dirent) => {
      if (Object.keys(dirent).length === 0) {
        resolve();
        return;
      }
      var ncms = [];
      dirent.forEach((d) => {
        if (d.isFile() && d.name.endsWith('.ncm')) {
          ncms.push(path.join(pathName, d.name));
        }
      });
      let count = 0;
      let length = ncms.length;
      ncms.forEach((ncm) => {
        console.log('(%d/%d) %s', ++count, length, ncm);
        exec('./ncmdump "' + ncm + '"');
        resolve();
      });
    });
  });
}

function readFiles(pathName, dict, sync) {
  console.log(pathName);
  return new Promise((resolve) => {
    fs.readdir(pathName, {withFileTypes:true}, (err, dirent) => {
      var length = Object.keys(dirent).length;
      if (length === 0) {
        resolve();
        return;
      } 
      var p = [];
      var count = 0;
      dirent.forEach((d) => {
        let f = path.join(pathName, d.name);
        if (d.isFile() && !d.name.startsWith('.') && !d.name.endsWith('.ncm')) {
          p.push(new Promise((resolve) => {
            if (useMd5) {
              if (!sync) {
                md5File(f, (err, hash, fileName) => {
                  dict[hash] = path.basename(fileName);
                  ++count;
                  console.log('(%d/%d) %s, %s', count, length, path.basename(fileName), hash);
                  resolve();
                });
              } else {
                var hash = md5File.sync(f);
                dict[hash] = path.basename(f);
                ++count;
                console.log('(%d/%d) %s, %s', count, length, path.basename(f), hash);
                resolve();
              }
            } else {
              dict[path.basename(f)] = path.basename(f);
              ++count;
              console.log('(%d/%d) %s', count, length, path.basename(f));
              resolve();
            }
          }));  
        } else {
          --length;
          console.log('(%d/%d) skip file %s', count, length, f);
        }
      });
      return Promise.all(p)
        .then(function() {
          resolve();
          return;
        });
    });
  });
}

function delPlayerFiles() {
  return new Promise((resolve) => {
    fs.readdir(PlayerPath, {withFileTypes:true}, (err, dirent) => {
      if (dirent === undefined) {
        resolve();
        return;
      }
      let p = [];
      dirent.forEach((d) => {
        if (Object.values(localFiles).indexOf(d.name) === -1 || d.name.startsWith('.')) {
          p.push(new Promise((resolve) => {
            fs.unlink(path.join(PlayerPath, d.name), () => {
              console.log('del %s', d.name );
              resolve();
              return;
            });
          }));
        }
      });
      return Promise.all(p)
        .then(function () {
          resolve();
        });
    });  
  });
}

function CopyFiles() {
  return new Promise((resolve) => {
    var count = 0;
    var length = Object.keys(localFiles).length - Object.keys(playerFiles).length;
    console.log('(%d/%d)', count, length);
    let p = [];
    for (const [hash, fileName] of Object.entries(localFiles)) {
      let key = hash;
      if (!useMd5) {
        key = path.basename(fileName);
      }
      if (playerFiles[key] === undefined) {
        p.push(new Promise((resolve, reject) => {
          fs.copyFile(path.join(LocalPath, fileName), path.join(PlayerPath, fileName), (err) => {
            if (err) {
              reject(err);
            }
            ++count;
            console.log('(%d/%d) coping %s', count, length, path.basename(path.join(PlayerPath, fileName)));
            resolve();
          });
        }));
      }
    }
    return Promise.all(p)
      .then(function() {
        resolve();
      });
  });
}

convertNcm(LocalPath)
  .then(() => {
    return readFiles(LocalPath, localFiles, false);
  })
  .then(function () {
    return delPlayerFiles();
  })
  .then(function () {
    return readFiles(PlayerPath, playerFiles, true);
  })
  .then(function () {
    return CopyFiles();
  })
  .then(function() {
    console.log('end');
  })
  .catch(function(reason) {
    console.log(reason);
  });
