import TestMe from './test.directive'

export default {
  install (Vue: any) {
    Vue.directive('test-me', TestMe)
    // Vue.directive('other-directive', myOtherDirective)
  }
}
