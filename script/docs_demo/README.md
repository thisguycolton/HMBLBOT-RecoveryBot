# Docs screenshots

The pictures in the Docs (`public/docs-images/`, linked from `db/docs/**/*.md`) come from a made-up
demo group, the **Lantern Street Group**, with ten made-up members. Nobody in it is a real person.

To take them again after the app changes, on a **throwaway development database** (never production;
`seed.rb` refuses to run there):

```sh
bin/rails db:drop db:create db:migrate
ADMIN_EMAILS=demo-admin@example.com bin/rails runner script/docs_demo/seed.rb
RAILS_DEVELOPMENT_HOSTS=recoverybot.test ADMIN_EMAILS=demo-admin@example.com bin/rails s -p 3000   # in another terminal
node script/docs_demo/setup.js            # highlights, made in the reader
ADMIN_EMAILS=demo-admin@example.com bin/rails runner script/docs_demo/seed.rb   # again: notes on those highlights
node script/docs_demo/shoot.js            # every shot in shots.js, or: node script/docs_demo/shoot.js chat chips
```

- `seed.rb`: the demo data (people, group, meetings, chat, chips, decisions, treasury, worksheets…), plus the
  built-in data the migrations install (step worksheets, chip templates, the docs drafts, the Big Book).
- `shots.js`: the list of pictures: page, who's signed in, phone or computer, and what part to keep.
- `shoot.js`: takes them and saves WebP files (ImageMagick `convert`). Court verification is taken out of every picture.
- `sweep.js`: a quick look at any pages, into /tmp, while working on `shots.js`.

The browser reaches the app as `recoverybot.test` so no picture shows "localhost". Pictures whose name ends
in `-phone` show phone-sized in the Docs (`docs.css`).
