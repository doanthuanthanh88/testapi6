const EventEmitter = require("events")
import { LogService } from './LogService'

/// <User> User model in Database
export class User {
  /// id number
  id: number
  /// name string: user name 
  name: string
  /// birth object: birthday
  birth: {
    /// day number: day of month
    day: number,
    /// month number: month of year
    month: number,
    /// year number: full year
    year: number,
    /// timezone object: Time zone here
    timezone: {
      /// name string: time zone name
      name: string
    }
  }
}

/// <Room> Room model
export class Room {
  /// name string: Room name
  name: string
  /// user_ids User.id[]: List user in room
  user_ids: number[]
  /// creator_id User.id: First user create the room
  creator_id: number
}

export class HttpUser {

  /// [HttpUser.getUser]
  async getUser(id, role) {
    /// IF is admin
    if (role === 'admin') {
      /// print the role to screen
      console.log('admin')
    }
    /// ELSE is not admin
    else {
      /// {} => {LogService}: Add log to server
      await LogService.logToServer(id, role)
    }

    /// LOOP in 10 times
    for (let i = 0; i < 10; i++) {
      /// print index to screen
      console.log(i)
    }

  }

  /// [HttpUser.getCompany]
  async getCompany() {
    /// {} -> {Redis}: Publish hello
    new EventEmitter().emit('redis', 'hello')
    /// {} => {LogService}: Make a request to add log
    await LogService.logToServer(1, 'fake_user')
    /// {} <- {RabbitMQ}: Comsume event              
    new EventEmitter().on('kafka', 'hello')
  }

  // Run with context is worker
  /// [workerRun]{Worker} Start a worker
  workerRun() {
    /// Loop infinity
    while (true) {
      /// Print ok to screen
      console.log('ok')
    }

  }

  // Run with context is app
  /// [] Begin write sequence diagram from here
  async userController() {
    /// {Client} => {}: Request to run worker
    /// [workerRun]
    this.workerRun()

    /// note right of Client: Note right of client
    /// note left of Client: Note left of client
    /// parallel
    const [user, company] = await Promise.all([
      /// [HttpUser.getUser] Get user
      this.getUser(1, 'admin'),
      /// [HttpUser.getCompany] Get company
      this.getCompany(),
    ])

    /// note over {Client}, {RabbitMQ}: Message over here
    /// {Client} <= {}: Response {user: User{}, company: Company{}}
    return { user, company }

  }

}