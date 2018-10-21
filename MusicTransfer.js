const fs = require('fs')
const md5File = require('md5-file')
const path = require('path')
const events = require('events')

var LocalPath = '/Users/king/Music/网易云音乐'
var PlayerPath = '/Volumes/Untitled/MUSIC'
var localFiles = {}
var playerFiles = {}

function CheckFinish(emitter, len, count) {
	if (len === count) {
		console.log('emit finish')
		emitter.emit('finish')
	}
}
function ReadFiles(pathName, dict, sync, cb) {
	if (typeof cb !== 'function') {
		throw new TypeError('Argument cb must be a function')
	}
	console.log(pathName)
	fs.readdir(pathName, {withFileTypes:true}, (err, dirent) => {
		var length = Object.keys(dirent).length
		if (length === 0) {
			cb()
			return
		} 
		var emitter = new events.EventEmitter()
		var count = 0
		emitter.once('finish', () => {
			cb()
		})
		dirent.forEach((d) => {
            let f = path.join(pathName, d.name);
            if (d.isFile() && !d.name.startsWith('.')) {
                if (!sync) {
					md5File(f, (err, hash, fileName) => {
						dict[hash] = path.basename(fileName)
						++count
                        console.log("(%d/%d) %s, %s", count, length, path.basename(fileName), hash)
                        CheckFinish(emitter, length, count)
					})
				} else {
					var hash = md5File.sync(f)
					dict[hash] = path.basename(f)
                    ++count
                    console.log("(%d/%d) %s, %s", count, length, path.basename(f), hash)
                    CheckFinish(emitter, length, count)
				}
			} else {
            	--length
				console.log('(%d/%d) skip file %s', count, length, f)
				CheckFinish(emitter, length, count)
			}
		})
	})
}

function CheckPlayerFiles(cb) {
	if (typeof cb !== 'function') {
		throw new TypeError('Argument cb must be a function')
	}
    fs.readdir(PlayerPath, {withFileTypes:true}, (err, dirent) => {
        var length = Object.keys(dirent).length
        var count = 0
        var emitter = new events.EventEmitter()
        emitter.on('delete', (fileName) => {
            console.log('del %s', fileName )
            fs.unlink(path.join(PlayerPath, fileName), () => {
                CheckFinish(emitter, length, ++count)
            })
        })
        emitter.once('finish', () => {
            cb()
        })
		dirent.forEach((d) => {
            if ( Object.values(localFiles).indexOf(d.name) === -1 || d.name.startsWith('.')) {
                emitter.emit('delete', d.name)
            } else {
                CheckFinish(emitter, length, ++count)
            }
		})
    })
}

function CopyFiles() {
	var emitter = new events.EventEmitter()
	var count = 0
	var length = Object.keys(localFiles).length - Object.keys(playerFiles).length
    console.log("(%d/%d)", count, length)
    emitter.on('copy', (src, dst) => {
		fs.copyFile(src, dst, (err) => {
			if (err) {
				throw err;
			}
            ++count
            console.log("(%d/%d) coping %s", count, length, path.basename(dst))
        })
	})
	for (const [hash, fileName] of Object.entries(localFiles)) {
		if (playerFiles[hash] === undefined) {
			emitter.emit('copy', path.join(LocalPath, fileName), path.join(PlayerPath, fileName))
		}
	}
}

ReadFiles(LocalPath, localFiles, false, () => {
    CheckPlayerFiles(() => {
		ReadFiles(PlayerPath, playerFiles, true, () => {
			CopyFiles()
		})
	})
})
