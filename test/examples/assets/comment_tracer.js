// [HttpUser] namespace
class HttpUser {

  // [> getUser]  Service ->> UserService: Get user by id
  getUser(id) {
    // [-] alt Check user id must be greater than 0
    if (id > 0)
      // [-] Service -->> Service: Return user information
      return { name: 'thanh' }
    // [-] else
      // [-] Service -->> Service: Return null
    return null
    // [-] end
  }
  // [>]

  // [>> userController] Client ->> Service: Get user information
  userController() {
    // [< getUser]
    const user = this.getUser()

    // [-] alt User not existed
    if (!user) console.log(user) // [-] Service -->> Service: Print user to console
    // [-] end

    return user
  }
  // [>] Client <<-- Service: Return user information

}