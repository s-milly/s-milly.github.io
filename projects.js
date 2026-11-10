/*
  Edit this file to manage the site. No other file needs to change.

  githubUser  Your GitHub username. When set, public (non-fork) repos load
              automatically, newest first. Leave "" to use only the list below.
  featured    Repo names to show first, in this order.
  hide        Repo names to leave off the site.
  projects    Hand-written entries. Use these to add or override details
              (a better description, a live demo link, a tag line).
              { name, title, description, url, language, cta, image }
              cta replaces "View on GitHub →" at the bottom of the card.
              image is a picture for the top of the card (16:10, e.g. 960x600),
              kept in assets/projects/.
*/
window.SITE = {
  githubUser: "s-milly",
  featured: ["music-composer", "shelf-signal", "review-signal", "four-fronts", "pitch-identifier", "super-bowl-defense", "pgh-bridges-bus"],
  hide: [],
  projects: [
    {
      name: "shelf-signal",
      image: "assets/projects/shelf-signal.webp",
      title: "How Much Should a Store Order?",
      description: "A monthly order sheet that stocks each product by what a mistake costs. Tested on 12 months of Walmart sales, it cut lost profit plus overstock from $253K to $109K.",
      url: "https://github.com/s-milly/shelf-signal",
      language: "Python",
      cta: "Read the case study →"
    },
    {
      name: "review-signal",
      image: "assets/projects/review-signal.webp",
      title: "Can Yelp Reviews Spot Closing Restaurants?",
      description: "Tested whether 552,940 Yelp reviews could forecast restaurant traffic. They could not, so the product changed: reviews now flag closure risk, and 9 of the 20 riskiest restaurants closed.",
      url: "https://github.com/s-milly/review-signal",
      language: "Python",
      cta: "Read the case study →"
    },
    {
      name: "music-composer",
      image: "assets/projects/music-composer.webp",
      title: "Music Composer",
      description: "Describe a song and AI writes it while a band plays it on stage. Trained on 3,307 songs across five genres.",
      url: "https://s-milly.github.io/music-composer/",
      language: "Python",
      cta: "Make a song →"
    },
    {
      name: "pokemon-safari-zone",
      image: "assets/projects/pokemon-safari-zone.webp",
      title: "Pokémon Quiet Safari",
      description: "A classroom volume game which rewards staying silent while working. While the room stays quiet, Pokémon from Red and Blue will appear across 12 different habitats. Get too loud and they run away.",
      url: "https://pokemon-safari-zone-xi.vercel.app/",
      language: "JavaScript",
      cta: "Play it →"
    },
    {
      name: "four-fronts",
      image: "assets/projects/four-fronts.webp",
      title: "Four Fronts",
      description: "A one-life sword-fighting arcade game written in C++ with OpenGL, rebuilt to play right in the browser.",
      url: "four-fronts/",
      language: "C++",
      cta: "Play it →"
    },
    {
      name: "pitch-identifier",
      image: "assets/projects/pitch-identifier.webp",
      title: "What Pitch Was That?",
      description: "Names a pitch from its speed, spin and movement. 87.8% accurate on MLB pitchers it never saw and 90.1% on college pitchers.",
      url: "https://s-milly.github.io/pitch-identifier/",
      language: "Python",
      cta: "Try it →"
    },
    {
      name: "super-bowl-defense",
      image: "assets/projects/super-bowl-defense.webp",
      title: "Does Defense Win Championships?",
      description: "Ranks every Super Bowl team's offense and defense from 1966 to 2025 to test the old saying.",
      url: "https://s-milly.github.io/super-bowl-defense/",
      language: "Python",
      cta: "See the charts →"
    },
    {
      name: "pgh-bridges-bus",
      image: "assets/projects/pgh-bridges-bus.webp",
      title: "Pittsburgh Bridges and Bus Riders",
      description: "Matches every Pittsburgh bus route to the federal bridge inventory. 22 bridges rated Poor carry buses, crossed 1,827 times a weekday.",
      url: "https://s-milly.github.io/pgh-bridges-bus/",
      language: "Python",
      cta: "See the findings →"
    },
    {
      name: "s-milly.github.io",
      image: "assets/projects/s-milly.github.io.webp",
      title: "Personal Website",
      description: "This site: a scroll-driven portfolio in plain HTML, CSS and JavaScript.",
      url: "https://github.com/s-milly/s-milly.github.io",
      language: "JavaScript"
    }
  ]
};
