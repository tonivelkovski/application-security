import { createHash } from 'crypto'

export function createSHA256(text, sol) {
    const hash = createHash('sha256')

    hash.write(text + sol)
    let output = hash.digest('hex')
    hash.end()

    return output
}

export function giveRandomNumber (min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)

    return Math.floor(Math.random() * (max - min) + min)
}