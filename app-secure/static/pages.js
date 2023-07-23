import {readFileSync} from 'fs'

const readFileContents = (fileName) => readFileSync(new URL(`./html/${fileName}.html`, import.meta.url))
const constructPage = (fileName) => header + readFileContents(fileName) + footer
const header = readFileContents('header')
const footer = readFileContents('footer')

export const index = constructPage('index')
export const sqli = constructPage('sqli')
export const xss = constructPage('xss')
export const inputValidation = constructPage('input_validation')
export const dos = constructPage('dos')
export const clientManipulation = constructPage('client_manipulation')
export const dictionaryAttack = constructPage('dictionary_attack')
export const csrf = constructPage('csrf')
export const shell = constructPage('shell')
export const brute = constructPage('bruteforce')
export const pharming = constructPage('pharming')
export const sessionHij = constructPage('sessionhij')
export const directoryTraversal = constructPage('directory_traversal')


export const malicious = constructPage('maliciousweb')
export const notFound = constructPage('not_found')