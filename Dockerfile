FROM ruby:3.2.3-alpine AS builder
RUN apk add \
  build-base \
  postgresql-dev
COPY Gemfile* ./
RUN bundle install
FROM ruby:3.2.3-alpine AS runner
RUN apk add \
  tzdata \
  nodejs \
  postgresql-dev
WORKDIR /app
# We copy over the entire gems directory for our builder image, containing the already built artifact
COPY --from=builder /usr/local/bundle/ /usr/local/bundle/
COPY ./ ./
EXPOSE 3000
RUN bundle exec rails assets:precompile
RUN RAILS_ENV=production SECRET_KEY_BASE=c36dd7e468987186e90107839224b824a7012c025bdb65937fca615c0321ece936b336a421a130adae50e255f716c52966f68b9e19fbbe5d82fe78f337ba78df bundle exec rails db:create

CMD ["rails", "server", "-e"]