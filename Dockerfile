
ARG RUBY_VERSION=3.2.3

FROM ruby:${RUBY_VERSION}-alpine AS builder
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
RUN gem install nokogiri-1.18.3-x86_64-linux-musl
RUN gem update --system && gem install bundler

COPY --from=builder /usr/local/bundle/ /usr/local/bundle/
COPY ./ ./


EXPOSE 3000

CMD ["bundle", "exec", "rails", "s", "-b", "0.0.0.0"]