import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const baseConfig = {
  description: 'AI Homework MiniApp WeChat project config',
  packOptions: { ignore: [] },
  setting: {
    urlCheck: false,
    es6: true,
    postcss: true,
    minified: true,
    newFeature: true,
    bigPackageSizeSupport: true,
  },
  compileType: 'miniprogram',
  libVersion: '',
  appid: 'touristappid',
  projectname: 'AI Homework MiniApp',
  condition: {
    search: { current: -1, list: [] },
    conversation: { current: -1, list: [] },
    game: { current: -1, list: [] },
    miniprogram: { current: -1, list: [] },
  },
}

const privateConfig = {
  projectname: 'AI Homework MiniApp',
  setting: {
    urlCheck: false,
  },
}

const targets = [
  {
    file: resolve('project.config.json'),
    config: {
      ...baseConfig,
      miniprogramRoot: 'dist/build/mp-weixin/',
      srcMiniprogramRoot: 'dist/build/mp-weixin/',
    },
  },
  {
    file: resolve('project.private.config.json'),
    config: privateConfig,
  },
  {
    file: resolve('dist/build/project.config.json'),
    config: {
      ...baseConfig,
      miniprogramRoot: 'mp-weixin',
      srcMiniprogramRoot: 'mp-weixin',
    },
  },
  {
    file: resolve('dist/build/mp-weixin/project.config.json'),
    config: {
      ...baseConfig,
      miniprogramRoot: './',
      srcMiniprogramRoot: './',
    },
  },
  {
    file: resolve('dist/build/mp-weixin/project.private.config.json'),
    config: privateConfig,
  },
]

for (const target of targets) {
  await mkdir(dirname(target.file), { recursive: true })
  await writeFile(target.file, `${JSON.stringify(target.config, null, 2)}\n`, 'utf8')
}

console.log('[miniapp] WeChat project configs prepared.')
