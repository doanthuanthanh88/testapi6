class BaseTag {
  setup() {}
  prepare() {}
  beforeExec() {}
  exec() {}
}

exports.MyTag = class MyTag extends BaseTag {
  setup() {
    console.log('Must overide setup. This run when init tag')
  }

  prepare() {
    console.log('Must overide. This run beforeExec. Run before check disabled')
  }

  beforeExec() {
    console.log('Must overide. This run before exec. Run after check disabled = false')
  }

  exec() {
    console.log('Must overide running')
  }
}