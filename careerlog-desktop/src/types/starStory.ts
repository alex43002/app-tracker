/** A reusable behavioral-interview story in the STAR format (interview prep). */
export interface StarStory {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StarStoryInput {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  tags: string[];
}
