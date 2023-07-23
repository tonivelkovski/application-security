### Dependencies

* NodeJS | node `v18.12.1`
* Node Package Manager | npm `v9.6.6`
* SQLite | sqlite3 `v3.37.2`

### Running the Web app

#### 1. Create a database
```bash
npm run initdb
```

#### 2. Install the necessary dependencies
```bash
npm i
```

#### 3. Run the app
```
npm start
```

### Develop mode

Additional dependencies (not necessary):
* nodemon `v2.0.22` (npm i -g nodemon)

#### 1. Create a database
```bash
npm run initdb
```

#### 2. Install the necessary dependencies
```bash
npm i
```

#### 3. Run the app
```
npm start
```
Also, you can run the server in the hot-reload mode using
```bash
npm run dev
```
or simply
```bash
nodemon
```

You can also reset the database using
```bash
npm run clear
```