import express from 'express'
import fs from 'fs'
import shell from 'shelljs'
import formidable from 'formidable'
import cookieParser from 'cookie-parser'
import path from 'path'

import {port} from './conf.js'
import * as pages from './static/pages.js'
import db from './db/db.js'

const app = express()
app.use(express.urlencoded({extended: true}))
app.use(express.json())
app.use(cookieParser())

app.get('/', (req, res) => res.send(pages.index))

app.get('/sqli', (req, res) => res.send(pages.sqli))
app.post('/sqli', (req, res) => {
    const {username, password} = req.body
    if (!(username && password)) return res.send(pages.sqli)

    const sql = `SELECT * FROM users WHERE username = "${username}" AND password = "${password}"`
    db.get(sql, (err, row) =>
        res.send(row ? pages.sqli.replace('Logged out', 'Logged in') : pages.sqli)
    )
})

app.get('/xss', (req, res) => {
    const page = pages.xss
    const createCommentRow = (c) => `<tr><td>${c.id}</td><td>${c.comment}</td></tr>`

    db.all('SELECT * FROM comments', (err, rows) => {
        if (err) return console.error(err)
        const comments = rows.map(comment => createCommentRow(comment)).join('')
        res.send(page.replace(/{{comments}}/, comments))
    })
})
app.post('/xss', (req, res) => {
    const {comment} = req.body
    if (!comment) return res.redirect('/xss')

    db.run('INSERT INTO comments (comment) VALUES(?)', [comment], (err) => {
        if (err) console.error(err.message)
    })

    res.redirect('/xss')
})

app.get('/shell', (req, res) => {
    const {search} = req.query
    const page = pages.shell
    const createFileElement = (x) => `<li>${x}</li>`
    const mapFilesToHtmlFormat = (x) => x.split('\n').map(fileName => {
        if (fileName) return createFileElement(fileName)
    }).join('')

    const userFiles = shell.exec('ls ./static/files/' + (search ? ` | grep ^${search}` : ''))
    res.send(userFiles.stdout ?
        page.replace(/{{files}}/, mapFilesToHtmlFormat(userFiles.stdout)) :
        page.replace(/{{files}}/, "There are no such files stored on the server.")
    )
})

app.get('/iv', (req, res) => res.send(pages.inputValidation))
app.post('/iv', (req, res) => {
    const form = new formidable.IncomingForm()

    form.parse(req, (err, fields, files) => {
        const {image} = files
        const uploaddir = new URL(`./static/files/${image.originalFilename}`, import.meta.url).pathname

        fs.rename(image.filepath, uploaddir, (err) => {
            if (err) console.error(err)
            res.redirect('/iv')
        })
    })
})

app.get('/dos', (req, res) => res.send(pages.dos))

app.get('/cm', (req, res) => res.send(
    pages.clientManipulation
        .replace(/{{status}}/, 'Logged out')
        .replace(/{{userFeat}}/, 'hidden')
        .replace(/{{adminFeat}}/, 'hidden')
))
app.post('/cm', (req, res) => {
    const {username, password} = req.body
    if (!(username && password)) return res.redirect('/cm')

    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?'
    db.get(sql, [username, password], (err, row) => {
        if (err) throw Error(err)

        const isLoginSuccessful = !!row
        const isAdmin = isLoginSuccessful && row.username === 'admin'

        const page = pages.clientManipulation
            .replace(/{{status}}/, isLoginSuccessful ? `Logged in [${username}]` : 'Logged out')
            .replace(/{{userFeat}}/, isLoginSuccessful ? '' : 'hidden')
            .replace(/{{adminFeat}}/, isAdmin ? '' : 'hidden')
        res.send(page)
    })
})

app.get('/dictionary', (req, res) => res.send(pages.dictionaryAttack))

app.get('/csrf', (req, res) => res.send(pages.csrf))
app.post('/csrf', (req, res) => {
    const {username, password} = req.body

    db.run('UPDATE users SET password = ? WHERE username = ?', [password, username], (err) => {
        if (err) console.error(err.message)
    })

    res.send('Password changed successfully')
})

app.get('/directoryTraversal', (req, res) => res.send(pages.directoryTraversal))
app.get('/traverse', (req, res) => {
    const {directory} = req.query
    const filePath = path.resolve(process.cwd(), directory)
    res.sendFile(filePath)
})

app.get('/brute', (req, res) => res.send(pages.brute))
app.post('/brute', (req, res) => {
    const {username, password} = req.body
    if (!(username && password)) return res.send(pages.brute)

    const sql = `SELECT * FROM users WHERE username = "${username}" AND password = "${password}"`
    db.get(sql, (err, row) => {
        return res.status(row ? 200 : 400).send()
    })
})

app.get('/pharming', (req, res) => {
    const page = pages.pharming
    const createGameRow = (c) => `<li><a href=${c.link}>${c.name}<a/></li>`

    db.all('SELECT * FROM games', (err, rows) => {
        if (err) return console.error(err)
        const games = rows.map(game => createGameRow(game)).join('')
        res.send(page.replace(/{{games}}/, games))
    })
})
app.post('/pharming', (req, res) => {
    const {name, link} = req.body
    if (!name && link) return res.redirect('/pharming')

    db.run('INSERT INTO games (name,link) VALUES(?,?)', [name, link], (err) => {
        if (err) console.error(err.message)
    })
    res.redirect('/pharming')
})
app.get('/download-malicious-file', (req, res) => {
    const file = `./static/host-file-changer`
    res.download(file)
})
app.get('/malicious-website', (req, res) => res.send(pages.malicious))

app.get('/sessionHij', (req, res) => res.send(pages.sessionHij))
let sessionId = 999
const sessions = {}
app.post('/sessionHij', (req, res) => {
    const {username, password} = req.body
    if (!(username && password)) return res.send(pages.sessionHij)

    const createNewSessionID = () => ++sessionId

    const newSessionId = createNewSessionID()
    res.cookie('sessionId', newSessionId)
    sessions[newSessionId] = {
        user: username
    }

    res.status(200).send()
})
app.get('/sessionHij-profile', (req, res) => {
    const {sessionId} = req.cookies

    sessions[sessionId] ? res.send({user: sessions[sessionId].user}) :
        res.redirect('/sessionHij')
})

app.use((req, res) => res.status(404).send(pages.notFound))

app.listen(port, () =>
    console.info(`[ INFO ${new Date().toISOString()} ] Server successfully started on port ${port}`)
)