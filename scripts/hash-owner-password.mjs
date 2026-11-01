import { emitKeypressEvents } from 'node:readline'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

let password = ''

if (process.stdin.isTTY) {
  process.stderr.write('Owner password (hidden): ')
  emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
  password = await new Promise((resolve) => {
    let value = ''
    process.stdin.on('keypress', (character, key) => {
      if (key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false)
        process.exit(130)
      }
      if (key.name === 'return') {
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stderr.write('\n')
        resolve(value)
      } else if (key.name === 'backspace') {
        value = value.slice(0, -1)
      } else if (character && !key.ctrl && !key.meta) {
        value += character
      }
    })
  })
} else {
  for await (const chunk of process.stdin) password += chunk.toString()
  password = password.replace(/\r?\n$/, '')
}

if (!password.length || password.length > 1024) {
  process.stderr.write('Use a non-empty password of at most 1024 characters.\n')
  process.exit(1)
}

console.log(await new Scrypt({}).make(password))
