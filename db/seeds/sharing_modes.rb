# ACID QUEST sharing modes: different ways into the same topic. Safe to re-run.
[
  { key: "story",           name: "Story",           icon_name: "icon_parchment",  gentle: false, prompt: "Tell us about a time this showed up in your life." },
  { key: "experience",      name: "Experience",      icon_name: "icon_light_bulb", gentle: false, prompt: "What have you learned about this in recovery?" },
  { key: "check_in",        name: "Check-In",        icon_name: "icon_face",       gentle: true,  prompt: "How is this showing up for you today?" },
  { key: "reflection",      name: "Reflection",      icon_name: "icon_mirror",     gentle: false, prompt: "What does this mean to you right now?" },
  { key: "lesson",          name: "Lesson",          icon_name: "icon_key",        gentle: false, prompt: "What has this taught you, maybe the hard way?" },
  { key: "change",          name: "Change",          icon_name: "icon_reset",      gentle: false, prompt: "How has your relationship with this changed since you got sober?" },
  { key: "connection",      name: "Connection",      icon_name: "icon_follow",     gentle: true,  prompt: "Who has helped you with this, or who could you help?" },
  { key: "funny_story",     name: "Funny Story",     icon_name: "icon_dice",       gentle: true,  prompt: "Got a funny story about this? Laughter counts too." },
  { key: "looking_forward", name: "Looking Forward", icon_name: "icon_map",        gentle: false, prompt: "What would you like your relationship with this to look like in the future?" },
  { key: "what_i_carry",    name: "What I Carry",    icon_name: "icon_bag",        gentle: false, prompt: "What part of this do you carry with you today?" },
  { key: "gratitude",       name: "Gratitude",       icon_name: "icon_heart",      gentle: true,  prompt: "What are you grateful for when it comes to this?" },
].each_with_index do |attrs, i|
  mode = SharingMode.find_or_initialize_by(key: attrs[:key])
  mode.update!(attrs.merge(position: i))
end
