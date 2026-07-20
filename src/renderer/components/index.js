import upperFirst from 'lodash/upperFirst'
import camelCase from 'lodash/camelCase'
import { defineAsyncComponent } from 'vue'
import LayoutIcons from './layout/Icons.vue'

const requireComponent = require.context('./', true, /\.vue$/, 'lazy')

const eagerComponents = {
  LayoutIcons,
}

const vueFileRxp = /\.vue$/

export default app => {
  requireComponent.keys().forEach(fileName => {
    const filePath = fileName.replace(/^\.\//, '')

    if (!filePath.split('/').every((path, index, arr) => {
      const char = path.charAt(0)
      return vueFileRxp.test(path) || char.toUpperCase() !== char || arr[index + 1] == 'index.vue'
    })) return

    let componentName = upperFirst(camelCase(filePath.replace(/\.\w+$/, '')))

    if (componentName.endsWith('Index')) componentName = componentName.replace(/Index$/, '')

    const eagerComponent = eagerComponents[componentName]
    if (eagerComponent) {
      app.component(componentName, eagerComponent)
      return
    }

    app.component(componentName, defineAsyncComponent({
      loader: async() => {
        const componentConfig = await requireComponent(fileName)
        return componentConfig.default || componentConfig
      },
      delay: 0,
    }))
  })
}
