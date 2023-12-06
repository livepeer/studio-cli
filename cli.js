#!/usr/bin/env node

import chalk from 'chalk'
import path from 'path'
import fs from 'fs'
import { input } from '@inquirer/prompts'
import { Command } from 'commander'
import select from '@inquirer/select'
import {execa, execaCommand} from 'execa'
import ora from 'ora'
import childProcess from 'child_process'

const log = console.log
const program = new Command()
const green = chalk.green

const isYarnInstalled = () => {
  try {
    childProcess.execSync('yarn --version');
    return true;
  } catch {
    return false; 
  }
}

const isBunInstalled = () => {
  try {
    childProcess.execSync('bun --version')
    return true;
  } catch(err) {
    return false; 
  }
}

async function main() {
  const spinner = ora({
    text: 'Creating codebase'
  })
  try {
    const kebabRegez = /^([a-z]+)(-[a-z0-9]+)*$/

    program
      .name('Create Livepeer App')
      .description('Create a new social app with a single command.')
      .option('-t, --type <type of app>', 'Set the app type as basic or PWA')
  
    program.parse(process.argv)
  
    const options = program.opts()
    const args = program.args
    let type = options.type
    let appName = args[0]
  
    if (!appName || !kebabRegez.test(args[0])) {
      appName = await input({
        message: 'Enter your app name',
        default: 'livepeer-app',
        validate: d => {
         if(!kebabRegez.test(d)) {
          return 'please enter your app name in the format of my-app-name'
         }
         return true
        }
      })
    }

    let  envs = `
    # Livepeer API Key
LIVEPEER_API_KEY=""

NEXT_PUBLIC_PLAYBACK_ID=""
`
    
    const withEnv = await select({
      message: 'Configure environment variables now?',
      choices: [
        {
          name: 'Yes',
          value: 'yes',
        },
        {
          name: 'No',
          value: 'no',
        }
      ]
    })

    if (withEnv === 'yes') {
      log('Get Livepeer API Key at https://livepeer.studio/dashboard')
      const livepeer_api_key = await input({ message: "LivePeer API Key" })
      log('Create stream and get Playback ID at https://livepeer.studio/dashboard/streams')
      const playback_id = await input({ message: "Playback ID" })

      envs = `
# Livepeer API Key
LIVEPEER_API_KEY="${livepeer_api_key}"

# Livepeer Playback ID
NEXT_PUBLIC_PLAYBACK_ID="${playback_id}"
`
    }
  
    let repoUrl = 'https://github.com/dabit3/livepeer-boilerplate.git'

    log(`\nInitializing new Livepeer app \n`)

    spinner.start()
    await execa('git', ['clone', repoUrl, appName])

    let packageJson = fs.readFileSync(`${appName}/package.json`, 'utf8')
    const packageObj = JSON.parse(packageJson)
    packageObj.name = appName
    packageJson = JSON.stringify(packageObj, null, 2)
    fs.writeFileSync(`${appName}/package.json`, packageJson)
    fs.writeFileSync(`${appName}/.env.local`, envs)

    process.chdir(path.join(process.cwd(), appName))
    spinner.text = ''
    let startCommand = ''

    if (isBunInstalled()) {
      spinner.text = 'Installing dependencies'
      await execaCommand('bun install').pipeStdout(process.stdout)
      spinner.text = ''
      startCommand = 'bun dev'
      log('\n')
    } else if (isYarnInstalled()) {
      await execaCommand('yarn').pipeStdout(process.stdout)
      startCommand = 'yarn dev'
    } else {
      spinner.text = 'Installing dependencies'
      await execa('npm', ['install', '--verbose']).pipeStdout(process.stdout)
      spinner.text = ''
      startCommand = 'npm run dev'
    }
    spinner.stop() 
    log(`${green.bold('Success!')} Created ${appName} at ${process.cwd()} \n`)
    log(`To get started, change into the new directory and run ${chalk.cyan(startCommand)}`)
  } catch (err) {
    log('\n')
    if (err.exitCode == 128) {
      log('Error: directory already exists.')
    }
    spinner.stop()
  }
}
main()