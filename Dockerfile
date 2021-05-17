FROM alpine

RUN apk add --no-cache nodejs-current yarn wrk bash
WORKDIR /test

ENV MODULES=

ADD "https://www.random.org/cgi-bin/randbyte?nbytes=10&format=h" skipcache
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
RUN yarn global add testapi6-mongo
RUN yarn global add testapi6-redis
RUN yarn global add testapi6-sql
RUN yarn global add testapi6-rabbitmq
RUN yarn global add testapi6-grpc
RUN yarn global add testapi6-mockapi
RUN yarn global add testapi6 --prefix /usr/local/

ENTRYPOINT [ "/entrypoint.sh" ]
CMD ["/test"]

# docker run --rm -e "TERM=xterm-256color" -v $PWD:/scenario testapi6
