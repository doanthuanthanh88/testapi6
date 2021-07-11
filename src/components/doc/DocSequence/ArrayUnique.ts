export class ArrayUnique extends Array {
  add(...items: any[]) {
    let isGot = false
    items.forEach(item => {
      if (!this.includes(item)) {
        super.push(item)
        isGot = true
      }
    })
    return isGot
  }
}