# Vite's built files (public/vite/assets) have a hash of their contents in their names, so a
# changed file always gets a new name. Browsers and the apps may keep them for a year without
# asking again; otherwise every page load re-checks each script and stylesheet with the server,
# which is most of what makes moving between pages slow in the apps. Everything else in public/
# (service-worker.js, docs-images, icons) keeps the default, so changes to those still show.
class ImmutableViteAssets
  PREFIXES = ["/vite/assets/", "/vite-test/assets/"].freeze
  HEADER = "public, max-age=31536000, immutable".freeze

  def initialize(app)
    @app = app
  end

  def call(env)
    status, headers, body = @app.call(env)
    headers["cache-control"] = HEADER if status == 200 && env["PATH_INFO"].start_with?(*PREFIXES)
    [status, headers, body]
  end
end

Rails.application.config.middleware.insert_before ActionDispatch::Static, ImmutableViteAssets
