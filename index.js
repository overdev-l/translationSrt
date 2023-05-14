import fs from "fs"
import path from "path"
import minimist from 'minimist'
import Parser from 'srt-parser-2'
import { v4 } from "uuid"
import { cloneDeep } from 'lodash-es'
import { lightCyan, lightMagenta, lightGreen} from 'kolorist'

import { MD5 } from "./utils.js"




const API = 'https://fanyi-api.baidu.com/api/trans/vip/translate'
const args = minimist(process.argv.slice(2))
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const isDir = dir => fs.lstatSync(dir).isDirectory()
const isSrt = file => path.extname(file) === '.srt'
const parserInstance = new Parser.default()
const APPID = args.APPid
const APPSecret = args.APPSecret
const srt = []
console.log(APPID)
console.log(APPSecret)

function init() {
    const rootPath = path.resolve(__dirname, args.input)
    if (isDir(rootPath)) {
        querySrt(rootPath)
    }
}


function querySrt(dir) {
    const directory = fs.readdirSync(dir)
    for (let i = 0; i < directory.length; i++) {
        const d = directory[i]
        const p = path.resolve(dir, d)
        if (isDir(p)) {
            querySrt(p)
        }
        if (isSrt(p)) {
            srt.push(p)
        }
    }
}

init()






async function translator(p) {
    const content = fs.readFileSync(p, 'utf-8')
    const data = parserInstance.fromSrt(content)
    const newData = cloneDeep(data)
    async function parser(pointer = 0) {
        if (!newData[pointer]?.text) return
        const query = newData?.at(pointer)?.text
        console.log(`
        ${lightCyan('📃-file: ')}${lightCyan(path.basename(p))}
        ${lightCyan('👌-row: ')}${lightCyan(pointer + 1)}
        ${lightCyan('🦟-query: ')}${lightCyan(query)}`
        )
        const result = await translate(query)
        if (result.error_code) {
            console.error("errorCode:", result.error_code, "errorMsg:", result.error_msg)
            pointer++
            await parser(pointer)
            return
        }
        const dts = result.trans_result?.[0]?.dst
        data[pointer].text = dts
        pointer++

        await parser(pointer)
    }
    await parser()
    const srt = parserInstance.toSrt(data)
    return srt
}

function translate(query) {
    const salt = v4()
    const sign = MD5(`${APPID}${query}${salt}${APPSecret}`)
    const options = {
        q: query,
        from: args.from || 'en',
        to: args.to || 'zh',
        appid: APPID,
        salt: salt,
        sign: sign,
    }
    let url = `${API}?q=${encodeURIComponent(options.q)}&from=${options.from}&to=${options.to}&appid=${options.appid}&salt=${options.salt}&sign=${options.sign}`
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            fetch(url).then(res => res.json()).then(res => {
                resolve(res)
            })
        }, 1000)
    })
}

function saveFile(content, sourceFile) {
    const targetFile = sourceFile.replace(/\.srt$/, '.zh.srt')
    fs.writeFileSync(targetFile, content, 'utf-8')
    console.log(lightGreen(`🎉-save file: ${path.basename(targetFile)}`))

}

async function main(point = 0) {
    if (!srt[point]) return
    console.log(lightMagenta(`⚡️ Start translating ${path.basename(srt[point])}, total ${srt.length} files`))
    const srtData = await translator(srt[point])
    console.log(lightGreen(`👀 Translation Done!, The remaining ${ srt.length - point } file`))
    await saveFile(srtData, srt[point])
    point++
    await main(point)
}


main()