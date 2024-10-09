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
# RUN RAILS_ENV=production SECRET_KEY_BASE=6289ecd1c0ee332f500d2d1b6c0ffab83af00442bb46e017597da462a6a3368a3ae2bf3b71ab29a56ffdfb33d7cd5cdce0c7721decb4cd8093206d89ce0a2fa6 bundle exec rails db:create
RUN bundle exec rails db:migrate
CMD ["rails", "server", "-e"]