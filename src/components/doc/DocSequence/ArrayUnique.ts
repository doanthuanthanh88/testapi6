export class ArrayUnique extends Array {
  private serializeKey(txt) {
    return txt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  }

  add(...items: any[]) {
    let isGot = false
    items.forEach(item => {
      if (!this.find(e => this.serializeKey(item) === this.serializeKey(e))) {
        super.push(item)
        isGot = true
      }
    })
    return isGot
  }
}