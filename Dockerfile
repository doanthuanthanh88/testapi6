FROM alpine

RUN apk add --no-cache nodejs-current yarn wrk bash
WORKDIR /test

ENV MODULES=

RUN yarn global add testapi6-mongo testapi6-redis testapi6-sql testapi6-rabbitmq testapi6-grpc testapi6-mockapi
RUN yarn global add testapi6 --prefix /usr/local/

ADD "https://www.random.org/cgi-bin/randbyte?nbytes=10&format=h" skipcache
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT [ "/entrypoint.sh" ]
CMD ["/test"]

# docker run --rm -e "TERM=xterm-256color" -v $PWD:/scenario testapi6
