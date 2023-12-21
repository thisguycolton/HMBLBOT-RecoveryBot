Rails.application.routes.draw do

  resources :books do
    resources :pages, only: [:show], param: :page_number
  end
  resources :topics
  devise_for :users
  resources :readings
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Defines the root path route ("/")
   root "readings#index"
end
