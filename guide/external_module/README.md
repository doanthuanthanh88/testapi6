# External module
_Load external modules_

# How to use
1. Install external modules
```sh
  npm install $EXT_MODULE
```
2. After install, we got some new tags which is provide by the new modules

Example: _Install mysql external module_

- Install testapi6-sql
  ```sh
    yarn global add testapi6-sql
    # OR
    npm install -g testapi6-sql
  ```
- Create a scenario file `mysql_example.yaml`

  - We have 2 ways to use a external module

    1. Use `Require` to load external then use `MySql` tag

      ```yaml
      - Require:
        root: 
        modules:
          - testapi6-sql

      - MySql:
          title: MySQL - local
          connection: mysql://user:password@localhost/mydb
          queries: 
            - select * from users
            - title: Get users
              query: select * from users where name = ?
              args: 
                - thanh
              var: result

      - Echo: Result is ${result}
      ```

    2. Use `$Module.$Tag` without `Require`

      ```yaml
      - testapi6-mysql.MySql:
          title: MySQL - local
          connection: mysql://user:password@localhost/mydb
          queries: 
            - select * from users
            - title: Get users
              query: select * from users where name = ?
              args: 
                - thanh
              var: result

      - Echo: Result is ${result}
      ```

# Some external modules
1. [Redis](https://github.com/doanthuanthanh88/testapi6-redis): _Execute redis commands_
2. [Sql](https://github.com/doanthuanthanh88/testapi6-sql): _Execute mysql, postgres... query_
3. [Mongo](https://github.com/doanthuanthanh88/testapi6-mongo): _Execute mongo query command_
4. [MockApi](https://github.com/doanthuanthanh88/testapi6-mockapi) _Create mocking api and serve static files_
5. [gRPC](https://github.com/doanthuanthanh88/testapi6-grpc) _Create a gRPC server to mock data and gRPC client to call others_
