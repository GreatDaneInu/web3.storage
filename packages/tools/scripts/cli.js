#!/usr/bin/env node
import path from 'path'
import dotenv from 'dotenv'
import sade from 'sade'
import { fileURLToPath } from 'url'
import got from 'got'
import execa from 'execa'
import { minioCmd } from './minio.js'
import { isPortReachable } from './util.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prog = sade('api')

dotenv.config({
  path: path.join(__dirname, '..', '..', '..', '.env')
})

prog
  .command('cluster')
  .describe('Run ipfs cluster')
  .option('--start', 'Start docker container', false)
  .option('--stop', 'Stop docker container', false)
  .option('--project', 'Project name', 'ipfs-cluster')
  .option('--clean', 'Clean all dockers artifacts', false)
  .action(clusterCmd)
  .command('heartbeat', 'Ping opsgenie heartbeat')
  .option('--token', 'Opsgenie Token')
  .option('--name', 'Heartbeat Name')
  .action(heartbeatCmd)

minioCmd(prog)

/**
 * @param {Object} opts
 * @param {string} opts.project
 * @param {boolean} [opts.start]
 * @param {boolean} [opts.stop]
 * @param {boolean} [opts.clean]
 */
export async function clusterCmd ({ project, start, stop, clean }) {
  const composePath = path.join(__dirname, '../docker/cluster/docker-compose.yml')

  if (!project) {
    throw new Error('A project must be provided as parameter')
  }

  if (start) {
    if (await isPortReachable(9094)) {
      console.log('Skipped starting IPFS Cluster. Port 9094 is already in use, so assuming cluster is already running.')
    } else {
      await execa('docker-compose', [
        '--file',
        composePath,
        '--project-name',
        project,
        'up',
        '--detach'
      ])
    }
  }

  if (stop) {
    await execa('docker-compose', [
      '--file',
      composePath,
      '--project-name',
      project,
      'stop'
    ])
  }
  if (clean) {
    await execa('docker-compose', [
      '--file',
      composePath,
      '--project-name',
      project,
      'down',
      '--volumes',
      '--rmi',
      'local',
      '--remove-orphans'
    ])
  }
}

prog.parse(process.argv)

async function heartbeatCmd (opts) {
  try {
    await got(`https://api.opsgenie.com/v2/heartbeats/${opts.name}/ping`, {
      headers: {
        Authorization: `GenieKey ${opts.token}`
      }
    })
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
