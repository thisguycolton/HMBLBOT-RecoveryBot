// filepath: /home/colton/Projects/acid-test/acid-test/app/javascript/index.js
import { Application } from "@hotwired/stimulus";
import GameController from "./controllers/game_controller";

const application = Application.start();
application.register("game", GameController);