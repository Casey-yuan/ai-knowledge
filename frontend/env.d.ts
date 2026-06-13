/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module 'vditor' {
  const Vditor: any;
  export default Vditor;
}

declare module 'element-plus' {
  const _default: any;
  export default _default;
  export const ElMessage: any;
  export const ElMessageBox: any;
  export const ElLoading: any;
  export const ElNotification: any;
}
declare module 'element-plus/dist/locale/zh-cn.mjs' {
  const _default: any;
  export default _default;
}
