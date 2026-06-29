export interface StoryArc {
  id: string;
  title: string;
  description: string;
  chapters: Chapter[];
}

export interface Chapter {
  id: string;
  title: string;
  text: string;
  unlockCondition: string;
}

export const MAIN_STORY: StoryArc = {
  id: "main",
  title: "The BomberMeme Chronicles",
  description: "Discover the origins of the Meme Wars and your place in them.",
  chapters: [
    {
      id: "ch1",
      title: "Awakening",
      text: "You wake up in Meme City, a sprawling metropolis where memes are currency and bombs are the law. The Seven Factions are at war, and you are the wildcard that could tip the balance.",
      unlockCondition: "tutorial_complete",
    },
    {
      id: "ch2",
      title: "First Blood",
      text: "Your first victory draws attention. The Neon Cartel scouts you, while the Wild Circle watches from the shadows. Every choice you make shapes your destiny.",
      unlockCondition: "first_kill",
    },
  ],
};

export const STORY_ARCS: StoryArc[] = [MAIN_STORY];
