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
  featured: ["ai-composer", "pitch-identifier", "super-bowl-defense"],
  hide: [],
  projects: [
    {
      name: "ai-composer",
      title: "AI Composer",
      description: "Describe a song and AI writes it while a band plays it on stage. A reader trained on 5,521 musician-written descriptions picks the style (67.3% right on descriptions it never saw, against 31.3% by guessing), and a PyTorch network trained on 306 Bach chorales writes the notes. Includes a Song Maker for writing your own.",
      url: "https://github.com/s-milly/ai-composer",
      language: "Python"
    },
    {
      name: "pitch-identifier",
      title: "What Pitch Was That?",
      description: "A machine learning model that names a pitch from its speed, spin and movement. Trained on 1.4 million MLB pitches in Python, it is 87.8% accurate on pitchers it never saw and 90.1% on college pitchers, beating TrackMan's automatic tags (78.0%).",
      url: "https://github.com/s-milly/pitch-identifier",
      language: "Python"
    },
    {
      name: "super-bowl-defense",
      title: "Does Defense Win Championships?",
      description: "Tests the old saying with data. Ranks every Super Bowl team's regular-season offense and defense, 1966 to 2025, built from game-by-game scores in Python and charted in JavaScript.",
      url: "https://github.com/s-milly/super-bowl-defense",
      language: "Python"
    },
    {
      name: "s-milly.github.io",
      title: "Personal Website",
      description: "This site. A scroll-driven portfolio built with plain HTML, CSS and JavaScript, hosted on GitHub Pages.",
      url: "https://github.com/s-milly/s-milly.github.io",
      language: "JavaScript"
    }
  ]
};
