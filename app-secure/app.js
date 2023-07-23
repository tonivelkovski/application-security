import express from 'express'
import fs from 'fs'
import formidable from 'formidable'
import cookieParser from 'cookie-parser'
import path from 'path'
import { body, validationResult } from 'express-validator'
import rateLimit from 'express-rate-limit'
import session from 'express-session'
import csrf from 'csurf'
import bodyParser from 'body-parser'
import { createSHA256, giveRandomNumber } from './codes/codes.js'

import { google_secret_key, port, session_secret_key } from './conf.js'
import * as pages from './static/pages.js'
import db from './db/db.js'

const app = express()
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    next()
})
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cookieParser())
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests! You trying to DoS us?!"
}))
app.use(session({
    secret: session_secret_key,
    resave: false,
    saveUninitialized: true,
    httpOnly: true,  // do not let browser javascript access cookie ever
    // secure: true // only use cookie over https
}))

app.get('/', (req, res) => res.send(pages.index))

app.get('/sqli', (req, res) => res.send(pages.sqli))
app.post('/sqli', (req, res) => {
    const { username, password } = req.body
    if (!(username && password)) return res.send(pages.sqli)

    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?'
    db.get(sql, [username, password], (err, row) =>
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
app.post('/xss', [
    body('comment', 'Missing comment').trim().isLength({ min: 1 }).escape()
], (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty())
        return res.redirect('/xss')

    const { comment } = req.body
    if (!comment) return res.redirect('/xss')

    db.run('INSERT INTO comments (comment) VALUES(?)', [comment], (err) => {
        if (err) console.error(err.message)
    })

    res.redirect('/xss')
})

app.get('/shell', (req, res) => {
    const { search } = req.query
    const page = pages.shell
    const createFileElement = (x) => `<li>${x}</li>`
    const mapFilesToHtmlFormat = (x) => x.map(fileName => {
        if (fileName) return createFileElement(fileName)
    }).join('')

    fs.readdir('./static/files/',  (err, files) =>
        err ? console.error('Error reading files from directory:', err) :
            (function () {
                if (search)
                    files = files.filter((file) => file.startsWith(search))

                res.send(files.length !== 0 ?
                    page.replace(/{{files}}/, mapFilesToHtmlFormat(files)) :
                    page.replace(/{{files}}/, "There are no such files stored on the server.")
                )
            }())
    )
})

app.get('/iv', (req, res) => res.send(pages.inputValidation))
app.post('/iv', (req, res) => {
    const form = new formidable.IncomingForm({
        maxFileSize: 5 * 1024 * 1024 // 5MB
    })
    form.once('error', () => res.redirect('/iv'))

    form.parse(req, (err, fields, files) => {
        const { image } = files
        const [type, extension] = image.mimetype.split('/')
        if (type !== 'image')
            return res.redirect('/iv')

        const uploaddir = new URL(`./static/files/${image.newFilename}.${extension}`, import.meta.url).pathname
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
        .replace(/{{userFeat.+}}/, '')
        .replace(/{{adminFeat.+}}/, '')
))
app.post('/cm', (req, res) => {
    const { username, password } = req.body
    if (!(username && password)) return res.redirect('/cm')

    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?'
    db.get(sql, [username, password], (err, row) => {
        if (err) throw Error(err)

        const isLoginSuccessful = !!row
        const isAdmin = isLoginSuccessful && row.username === 'admin'

        const page = pages.clientManipulation
        const userFeat = /{{userFeat(.+)}}/.exec(page)[1]
        const adminFeat = /{{adminFeat(.+)}}/.exec(page)[1]

        res.send(page
            .replace(/{{status}}/, isLoginSuccessful ? `Logged in [${username}]` : 'Logged out')
            .replace(/{{userFeat.+}}/, isLoginSuccessful ? userFeat : '')
            .replace(/{{adminFeat.+}}/, isAdmin ? adminFeat : '')
        )
    })
})

app.get('/dictionary', (req, res) => res.send(pages.dictionaryAttack))

const csrfProtection = csrf({ cookie: true })
const parseForm = bodyParser.urlencoded({ extended: false })
app.get('/csrf', [csrfProtection], (req, res) => res.send(pages.csrf.replace(/{{csrfToken}}/, req.csrfToken())))
app.post('/csrf', [parseForm, csrfProtection], (req, res) => {
    const { username, password } = req.body

    let hashedPassword = createSHA256(password + giveRandomNumber(10000000, 90000000))

    db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username], (err) => {
        if (err) {
            console.error(err.message)
            res.status(500).send('Internal Server Error')
        } else {
            res.send('Password updated successfully')
        }
    })
})

app.get('/directoryTraversal', (req, res) => res.send(pages.directoryTraversal))
app.get('/traverse', (req, res) => {
    const { directory } = req.query
    const normalizedDirectory = path.normalize(directory)
    const allowedDirectories = ['static/files/primjer_datoteka.txt']

    const isDirectoryAllowed = allowedDirectories.some((allowedDirectory) =>
        path.normalize(allowedDirectory).toLowerCase() === normalizedDirectory.toLowerCase()
    )

    if (!isDirectoryAllowed) {
        return res.status(403).send('Access is denied')
    }

    const filePath = path.resolve(process.cwd(), normalizedDirectory)
    res.sendFile(filePath)
})

app.get('/brute', (req, res) => res.send(pages.brute))
app.post('/brute', (req, res) => {
    const { username, password } = req.body
    if (!(username && password)) return res.send(pages.brute)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/

    if (!passwordRegex.test(password))
        return res.status(400).send()

    const sql = `SELECT * FROM users WHERE username = ? AND password = ?`
    db.get(sql, [username, password], (err, row) => {
        return res.status(row ? (function () {
            return req.session.blocked && new Date().getTime() >= req.session.blockExpirationTime ?
                (function () {
                    req.session.blocked = false
                    req.session.numberOfAttempts = 1
                    return 200
                }()) : 400
        }()) : (function () {
            !req.session.numberOfAttempts ?
                req.session.numberOfAttempts = 1 :
                req.session.numberOfAttempts++

            if (req.session.numberOfAttempts === 3) {
                req.session.blockExpirationTime = new Date().getTime() + (20 * 60 * 1000)
                req.session.blocked = true
            }
            return 400
        }())).send()
    })
})

app.get('/pharming', (req, res) => {
    const page = pages.pharming
    const createGameRow = (g) => `<li><a href=${g.link}>${g.name}<a/></li>`

    db.all('SELECT * FROM games', (err, rows) => {
        if (err) return console.error(err)
        const games = rows.map(game => createGameRow(game)).join('')
        res.send(page.replace(/{{games}}/, games))
    })
})
app.post('/pharming', async (req, res) => {
    const { name, link } = req.body
    if (!(name && link)) return res.redirect('/pharming')

    const requestBody = {
        threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryType: "URL",
            threatEntryTypes: ['THREAT_ENTRY_TYPE_UNSPECIFIED'],
            threatEntries: [{ link }]
        }
    }

    const options = {
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        method: "POST",
        form: requestBody
    }

    const request = await fetch("https://safebrowsing.googleapis.com/v4/threatMatches:find?key=" + google_secret_key, options)
    const response = await request.text()

    if (Object.keys(JSON.parse(response)).length !== 0)
        return res.redirect("/pharming")

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
app.post('/sessionHij', (req, res) => {
    const { username, password } = req.body
    if (!(username && password)) return res.send(pages.sessionHij)

    req.session.user = username

    res.status(200).send()
})
app.get('/sessionHij-profile', (req, res) => {
    if (!req.session.user) return res.redirect('/sessionHij')
    res.send({ user: req.session.user })
})

app.use((req, res) => res.status(404).send(pages.notFound))

app.listen(port, () =>
    console.info(`[ INFO ${new Date().toISOString()} ] Server successfully started on port ${port}`)
)