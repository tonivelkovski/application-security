import sqlite from 'sqlite3'

sqlite.verbose()
const connection = new sqlite.Database('./database.db')
export default connection