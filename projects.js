/*
  Edit this file to manage the site. No other file needs to change.

  githubUser  Your GitHub username. When set, public (non-fork) repos load
              automatically, newest first. Leave "" to use only the list below.
  featured    Repo names to show first, in this order.
  hide        Repo names to leave off the site.
  projects    Hand-written entries. Use these to add or override details
              (a better description, a live demo link, a tag line).
              { name, description, url, demo, language, tags: [] }
*/
window.SITE = {
  githubUser: "s-milly",
  featured: ["music-composer", "pitch-identifier", "super-bowl-defense"],
  hide: [],
  projects: [
    {
      name: "music-composer",
      title: "Music Composer",
      description: "Describe a song and AI writes it while a band plays it on stage. Trained on 2,145 songs across five genres.",
      url: "https://github.com/s-milly/music-composer",
      language: "Python"
    },
    {
      name: "pitch-identifier",
      title: "What Pitch Was That?",
      description: "Names a pitch from its speed, spin and movement. 87.8% accurate on MLB pitchers it never saw and 90.1% on college pitchers.",
      url: "https://github.com/s-milly/pitch-identifier",
      language: "Python"
    },
    {
      name: "super-bowl-defense",
      title: "Does Defense Win Championships?",
      description: "Ranks every Super Bowl team's offense and defense from 1966 to 2025 to test the old saying.",
      url: "https://github.com/s-milly/super-bowl-defense",
      language: "Python"
    },
    {
      name: "s-milly.github.io",
      title: "Personal Website",
      description: "This site: a scroll-driven portfolio in plain HTML, CSS and JavaScript.",
      url: "https://github.com/s-milly/s-milly.github.io",
      language: "JavaScript"
    }
  ]
};
