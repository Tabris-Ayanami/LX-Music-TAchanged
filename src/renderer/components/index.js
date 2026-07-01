import { defineAsyncComponent } from 'vue'
import upperFirst from 'lodash/upperFirst'
import camelCase from 'lodash/camelCase'

import BaseBtn from './base/Btn.vue'
import BaseInput from './base/Input.vue'
import BasePopup from './base/Popup.vue'
import CommonProgressBar from './common/ProgressBar.vue'
import CommonTogglePlayModeBtn from './common/TogglePlayModeBtn.vue'
import CommonVolumeBtn from './common/VolumeBtn.vue'
import MaterialModal from './material/Modal.vue'
import MaterialPopupBtn from './material/PopupBtn.vue'
import MaterialSearchInput from './material/SearchInput.vue'
import LayoutAside from './layout/Aside/index.vue'
import LayoutIcons from './layout/Icons.vue'
import LayoutPlayBar from './layout/PlayBar/index.vue'
import LayoutToolbar from './layout/Toolbar/index.vue'
import LayoutView from './layout/View.vue'

const lazyComponent = require.context('./', true, /\.vue$/, 'lazy')

const vueFileRxp = /\.vue$/
const eagerComponents = {
  BaseBtn,
  BaseInput,
  BasePopup,
  CommonProgressBar,
  CommonTogglePlayModeBtn,
  CommonVolumeBtn,
  MaterialModal,
  MaterialPopupBtn,
  MaterialSearchInput,
  LayoutAside,
  LayoutIcons,
  LayoutPlayBar,
  LayoutToolbar,
  LayoutView,
}

const getComponentName = fileName => {
  const filePath = fileName.replace(/^\.\//, '')

  if (!filePath.split('/').every((path, index, arr) => {
    const char = path.charAt(0)
    return vueFileRxp.test(path) || char.toUpperCase() !== char || arr[index + 1] == 'index.vue'
  })) return null

  let componentName = upperFirst(camelCase(filePath.replace(/\.\w+$/, '')))

  if (componentName.endsWith('Index')) componentName = componentName.replace(/Index$/, '')

  return componentName
}

export default app => {
  for (const [componentName, component] of Object.entries(eagerComponents)) {
    app.component(componentName, component)
  }

  lazyComponent.keys().forEach(fileName => {
    const componentName = getComponentName(fileName)
    if (!componentName || Object.prototype.hasOwnProperty.call(eagerComponents, componentName)) return

    app.component(componentName, defineAsyncComponent(() => lazyComponent(fileName)))
  })
}
