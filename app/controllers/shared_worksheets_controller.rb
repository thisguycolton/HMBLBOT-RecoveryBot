# A worksheet someone shared with its own link and a password (StepWork#share!): /worksheet/:token
# is a small page (entrypoints/shared_worksheet.jsx) that asks for the password. Nothing about
# the worksheet is on the page until the password is right; never indexed.
class SharedWorksheetsController < ApplicationController
  layout "reader"
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }
  after_action { response.headers["Referrer-Policy"] = "no-referrer" }

  def show; end
end
