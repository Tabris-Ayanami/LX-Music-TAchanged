// 修补依赖源码以使vite构建的依赖恢复正常工作

const fs = require('node:fs')
const path = require('node:path')

const rootPath = path.join(__dirname, '../')

const patchs = [
  [
    path.join(rootPath, './node_modules/ws/package.json'),
    '\n      "browser": "./browser.js",',
    '',
  ],
  [
    path.join(rootPath, './node_modules/music-metadata/package.json'),
    '"default": "./lib/core.js"',
    '"default": "./lib/index.js"',
  ],
  [
    path.join(rootPath, './node_modules/strtok3/package.json'),
    '"default": "./lib/core.js"',
    '"default": "./lib/index.js"',
  ],
  [
    path.join(rootPath, './node_modules/@neteasecloudmusicapienhanced/api/module/login_qr_check.js'),
    '  } catch (error) {\n    return {\n      status: 200,\n      body: {},\n      cookie: result.cookie,\n    }\n  }',
    '  } catch (error) {\n    return {\n      status: 200,\n      body: {},\n      cookie: [],\n    }\n  }',
  ],
]

const patchDependencies = async() => {
  for (const [filePath, fromStr, toStr] of patchs) {
    console.log(`Patching ${filePath.replace(rootPath, '')}`)
    try {
      const file = (await fs.promises.readFile(filePath)).toString()
      await fs.promises.writeFile(filePath, file.replace(fromStr, toStr))
    } catch (err) {
      console.error(`Patch ${filePath.replace(rootPath, '')} failed: ${err.message}`)
    }
  }
  console.log('\nDependencies patch finished.\n')
}

module.exports = patchDependencies

if (require.main === module) patchDependencies()

