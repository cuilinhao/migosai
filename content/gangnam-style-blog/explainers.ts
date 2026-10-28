import type { BlogPost } from '../blog';
import { gangnamStylePrompt } from '../../lib/prompts/gangnam-style';
import { gangnamBlogPath, GANGNAM_BLOG_UPDATED } from './shared';

const studio = '/gangnam-style-ai-video-generator#studio';
const studioSource = { label: 'MigosAI Gangnam Style studio: current casting, output and soundtrack settings', url: studio };
const officialVideo = { label: 'PSY — GANGNAM STYLE, official music video', url: 'https://www.youtube.com/watch?v=9bZkp7q19f0' };
const youtubeHistory = { label: 'YouTube: Ten years of the Billion Views Club', url: 'https://blog.youtube/creator-and-artist-stories/10-years-of-youtubes-billion-views-club-psy-gangnam-style/' };
const youtubeMilestone = { label: 'YouTube: Gangnam Style reaches one billion views', url: 'https://blog.youtube/news-and-events/ytvev/' };
const referenceSite = { label: 'Groove: Gangnam Style AI reference examples', url: 'https://gangnamstyle.io/' };
const shortsHelp = { label: 'YouTube Help: Upload YouTube Shorts', url: 'https://support.google.com/youtube/answer/12779649?hl=en' };
const aiDisclosure = { label: 'YouTube Help: Disclosing AI-generated or altered content', url: 'https://support.google.com/youtube/answer/14328491?hl=en' };
const copyrightHelp = { label: 'YouTube Help: Copyright on YouTube', url: 'https://support.google.com/youtube/answer/2797466?hl=en' };

export const explainerPosts: BlogPost[] = [
  {
    slug: 'what-is-gangnam-style',
    path: gangnamBlogPath('what-is-gangnam-style'),
    title: 'What Is Gangnam Style? The Song, Dance and AI Trio Explained',
    metaTitle: 'What Is Gangnam Style? Song vs AI Video Trend (2026)',
    description: 'Understand the difference between PSY’s 2012 Gangnam Style music video and the AI trio template made from friends, one selfie or pet photos.',
    label: 'What Is Gangnam Style?',
    excerpt: 'The original song and horse dance have a different history from today’s photo-based AI trio. Here is how to tell them apart.',
    eyebrow: 'GANGNAM STYLE · EXPLAINED',
    datePublished: GANGNAM_BLOG_UPDATED,
    dateModified: GANGNAM_BLOG_UPDATED,
    intro: 'Gangnam Style is a song by South Korean artist PSY, best known for its 2012 music video and horse-riding dance. A **Gangnam Style AI video** is a separate creative format: a short template that places uploaded people or pets into a three-performer scene. The shared name does not make the AI result an official PSY video.',
    sections: [
      {
        id: 'original-video', title: 'Start with the original song and video', blocks: [
          { type: 'p', text: 'PSY’s official music video arrived on YouTube on July 15, 2012. YouTube’s anniversary account records that it crossed one billion views on December 21 that year. Those dates describe the original music video, not the launch of an AI generator or a new social-media challenge.' },
          { type: 'p', text: 'The original is a produced music video with its own cast, locations and choreography. Watching it is the clearest way to understand what people mean by the horse dance. An AI clip that uses the name may share an association or a sound without reproducing those scenes. Keep that distinction when describing your own upload.' },
        ],
      },
      {
        id: 'ai-trio', title: 'What the AI trio template actually does', blocks: [
          { type: 'p', text: 'The template on MigosAI uses a short reference scene with three foreground performers. Uploaded images provide their appearance, while the reference clip guides the sequence, camera and movement. The intended result moves through a group scene and individual moments, so there is more to check than whether the opening frame looks convincing.' },
          { type: 'p', text: 'This is an AI transformation, not footage of your friends attending a shoot. Identity can drift during movement or transitions, and hands, expressions or clothing may change. The examples show the visual idea; they are not a promise that every set of photos will produce the same likeness or motion quality.' },
        ],
      },
      {
        id: 'choose-cast', title: 'Choose three friends, one selfie or three pets', blocks: [
          { type: 'p', text: 'The cast choice answers a simple question: do you want different subjects or three versions of one subject? Friends mode takes three separate photos. Its upload roles are Middle, Right and Left, with the intended solo order following that same sequence. Check the role labels rather than assuming the upload boxes follow ordinary left-to-right stage positions.' },
          { type: 'p', text: `Three of you takes one selfie for all three roles. Pet trio takes three individual animal photos. These modes change the casting instructions; they do not turn a blurry group photo into three clean references. Compare the [single-selfie workflow](${gangnamBlogPath('gangnam-style-ai-video-from-one-selfie')}) and the [pet photo guide](${gangnamBlogPath('gangnam-style-ai-pet-video')}) before choosing your images.` },
        ],
      },
      {
        id: 'finished-clip', title: 'What you receive from this generator', blocks: [
          { type: 'p', text: 'The current MigosAI template uses fixed 16:9 landscape framing and offers 480p or 720p output. It is built around an approximately 15-second reference; the finished duration can vary slightly. New generations receive the reference clip’s soundtrack during processing, so the completed MP4 includes sound without a separate music-upload step.' },
          { type: 'p', text: `That soundtrack description does not mean a complete recording of PSY’s song or a blanket music licence. It identifies the audio used by this template. Read the [music and playback explanation](${gangnamBlogPath('gangnam-style-ai-video-music')}) for the difference between a file containing sound and permission to publish that sound on another platform.` },
        ],
      },
      {
        id: 'make-first-trio', title: 'Make a first version you can evaluate', blocks: [
          { type: 'p', text: `Open the [Gangnam Style studio](${studio}), select your cast and upload clear, individual photos you have permission to use. Review the previews and displayed credit cost before submitting. You do not need to learn choreography or write a prompt. The [step-by-step guide](${gangnamBlogPath('how-to-make-gangnam-style-ai-video')}) walks through the controls in order.` },
          { type: 'p', text: 'When the result is ready, watch the entire clip, including the opening, every solo and the final group shot. Look for recognizable subjects and consistent assignments, then listen to the downloaded file. A funny first impression is useful, but checking the transitions helps you decide whether the video is ready to share or needs another photo selection.' },
        ],
      },
    ],
    faqs: [
      { question: 'Is Gangnam Style AI the original music video?', answer: 'No. PSY’s official music video and a photo-based AI trio are different works. This generator uses a short reference template rather than recreating the complete 2012 video.' },
      { question: 'Do I need three people in one photo?', answer: 'No. Friends mode needs one separate photo for each of its three roles. Use Three of you when you want one selfie repeated across the cast.' },
      { question: 'Is MigosAI an official PSY product?', answer: 'No. MigosAI is an independent creative service. The template name does not imply artist, label or platform endorsement.' },
      { question: 'Does a finished video guarantee an exact likeness?', answer: 'No. Clear references help, but AI-generated identity, anatomy and movement can vary. Review the whole result before sharing it.' },
    ],
    sources: [officialVideo, youtubeHistory, referenceSite, studioSource],
  },
  {
    slug: 'what-does-gangnam-style-mean',
    path: gangnamBlogPath('what-does-gangnam-style-mean'),
    title: 'What Does Gangnam Style Mean? Gangnam, Oppa and the AI Template',
    metaTitle: 'What Does Gangnam Style Mean? Name and Oppa Explained',
    description: 'Learn what Gangnam means, how the Korean word oppa is used, and why the name of an AI trio template should not be confused with PSY’s original video.',
    label: 'What Does Gangnam Style Mean?',
    excerpt: 'A place name, a Korean form of address and a famous dance are often mixed together. Separate their meanings before making your own AI clip.',
    eyebrow: 'GANGNAM STYLE · NAME AND MEANING',
    datePublished: GANGNAM_BLOG_UPDATED,
    dateModified: GANGNAM_BLOG_UPDATED,
    intro: '**Gangnam Style** refers to a style associated with Gangnam, an area of Seoul. Gangnam literally means “south of the river” in Korean. The phrase became internationally familiar through PSY’s song, but it is not a literal Korean translation of “horse dance,” and it does not name an AI technology.',
    sections: [
      {
        id: 'gangnam-place', title: 'Gangnam is a real place in Seoul', blocks: [
          { type: 'p', text: 'Korea.net, the Korean government’s information site, explains the literal meaning of Gangnam and identifies the Seoul district’s connection to Korean popular culture. That gives the title a geographical starting point. It is not an invented word that PSY created solely for the chorus, nor is it a general name for every Korean dance.' },
          { type: 'p', text: 'Korea.net’s profile describes entertainment companies around Apgujeong and luxury shops along K-Star Road, which extends through Apgujeong and Cheongdam. These associations help explain how Gangnam can suggest celebrity, fashion and affluent city life as well as a location. That is useful cultural context for the title, without treating it as a definitive explanation of every joke in PSY’s video.' },
        ],
      },
      {
        id: 'oppa-meaning', title: 'What does oppa mean?', blocks: [
          { type: 'p', text: 'The National Institute of Korean Language’s dictionary gives two related uses for oppa: a female speaker referring to an older brother or male cousin, and an affectionate way for a female speaker to address an older male. The second use means it need not describe a family relationship. Context determines what the address is doing.' },
          { type: 'p', text: 'That vocabulary explanation should not become a word-for-word translation of an entire song. Performance can play with who is speaking and how a familiar address is used. For a short blog caption, explaining the term is usually more useful than repeating a phonetic mishearing. Oppa is not the English word “open,” and the title is not “Open Gangnam Style.”' },
        ],
      },
      {
        id: 'dance-name', title: 'Why people connect the name with a horse dance', blocks: [
          { type: 'p', text: 'The dance association comes from the performance, not from the dictionary meaning of Gangnam. YouTube’s contemporary account of the video’s billion-view milestone specifically connected its appeal with horse-like dance moves and widespread fan participation. That supports describing the riding gesture as a recognizable feature of PSY’s performance, without inventing a separate meaning for the title.' },
          { type: 'p', text: 'If you are explaining the dance to someone who has never seen it, link the official video rather than promising that an AI template teaches the complete choreography. A short AI edit may use a different sequence of poses, facial expressions or camera changes. Similar naming does not establish that every movement came from the original music video.' },
        ],
      },
      {
        id: 'ai-template-meaning', title: 'What the name means on an AI generator', blocks: [
          { type: 'p', text: 'On MigosAI, Gangnam Style identifies a particular photo-to-video trio template. You choose three friends, one selfie repeated three times, or three pets. The reference scene supplies the visual structure; your uploaded photographs supply the subjects. There is no requirement that the people in your photos live in Gangnam or know the dance.' },
          { type: 'p', text: `Describe that result as an AI-generated trio rather than a recording of an actual event. For the visual format and casting options, read [what a Gangnam Style AI video is](${gangnamBlogPath('what-is-gangnam-style')}). If your question is about the audio rather than the name, the [soundtrack guide](${gangnamBlogPath('gangnam-style-ai-video-music')}) explains what is added to new MigosAI results.` },
        ],
      },
      {
        id: 'use-name-clearly', title: 'Use the name clearly when sharing a clip', blocks: [
          { type: 'p', text: 'A useful caption tells viewers what they are seeing: an AI trio made from your own photos, a comparison with the original dance, or a personal reaction to the song. Those are different kinds of posts. Calling an AI edit “official” or presenting a friend’s invented performance as genuine would obscure the distinction the caption should explain.' },
          { type: 'p', text: `For a personal experiment, start with the [Gangnam Style studio](${studio}) and a set of photos everyone pictured has agreed to use. Choose your cast before uploading, then watch all three roles in the finished clip. The [photo selection guide](${gangnamBlogPath('best-photos-for-gangnam-style-ai-video')}) covers the practical preparation that matters more to your result than knowing every lyric.` },
        ],
      },
    ],
    faqs: [
      { question: 'Does Gangnam mean horse dance?', answer: 'No. Gangnam literally refers to the area south of the river. The horse-dance association comes from PSY’s performance.' },
      { question: 'Does oppa always mean a biological brother?', answer: 'No. The Korean dictionary also records an affectionate form of address used by a female speaker for an older male. The relationship depends on context.' },
      { question: 'Do I need Korean lyrics to use the AI template?', answer: 'No. MigosAI’s template takes photos and a casting choice, not a lyrics submission. It handles the reference scene and soundtrack through the generation workflow.' },
      { question: 'Does the template name imply an official collaboration?', answer: 'No. MigosAI is independent. The name is a description of the template, not a claim of affiliation with PSY or his label.' },
    ],
    sources: [
      { label: 'Korea.net: Gangnam and the meaning of its name', url: 'https://www.korea.net/NewsFocus/Culture/view?articleId=187640' },
      { label: 'National Institute of Korean Language: oppa dictionary entry', url: 'https://krdict.korean.go.kr/m/eng/searchResultView?ParaSenseSeq=&ParaWordNo=68006&fileNo=&imgCount=&multiMediaSeq=&nation=eng&searchKind=&searchKindValue=&shortenUrl=&studySeq=' },
      youtubeMilestone, officialVideo, studioSource,
    ],
  },
  {
    slug: 'how-to-make-gangnam-style-ai-video',
    path: gangnamBlogPath('how-to-make-gangnam-style-ai-video'),
    title: 'How to Make a Gangnam Style AI Video from Your Photos',
    metaTitle: 'How to Make a Gangnam Style AI Video: Photo-to-MP4 Guide',
    description: 'Make a Gangnam Style AI trio with three photos or one selfie. Follow the upload order, choose 480p or 720p, check credits and download your finished MP4.',
    label: 'How to Make Your AI Video',
    excerpt: 'Prepare your photos, assign the three roles, choose output quality and review the finished video with its template soundtrack.',
    eyebrow: 'GANGNAM STYLE · STEP-BY-STEP',
    datePublished: GANGNAM_BLOG_UPDATED,
    dateModified: GANGNAM_BLOG_UPDATED,
    intro: 'To make a Gangnam Style AI video on MigosAI, choose a casting mode, upload the required photos, select 480p or 720p and confirm the displayed credit cost. The template handles the reference scene and adds its soundtrack. Download the finished MP4 after processing; no prompt or timeline editing is required.',
    sections: [
      {
        id: 'prepare', title: '1. Prepare individual photos', blocks: [
          { type: 'p', text: 'Start with one clearly visible subject in each image. For people, an evenly lit face looking toward the camera is a useful starting point. Avoid sunglasses, masks, strong beauty filters and distant faces. A group photograph creates ambiguity about which person belongs in a role, even if everyone in the photo is recognizable to you.' },
          { type: 'p', text: `Use JPEG, PNG or WebP files up to 10 MB each. The prepared upload also needs both dimensions between 301 and 5,999 pixels and a width-to-height ratio greater than 0.4 and less than 2.5. If an image is rejected, follow the displayed size or format message. The [photo guide](${gangnamBlogPath('best-photos-for-gangnam-style-ai-video')}) explains suitable examples.` },
        ],
      },
      {
        id: 'cast', title: '2. Choose the cast and check the role labels', blocks: [
          { type: 'p', text: `Open the [Gangnam Style studio](${studio}). Gangnam Style trio uses three separate references. Upload the first solo subject to Middle, the second to Right and the third to Left. Left and right describe the viewer’s view of the scene. Check each preview before continuing; the box order is an assignment system, not just a place to collect files.` },
          { type: 'p', text: `Choose Three of you for one selfie used across all three roles, or Pet trio for three individual pets. Changing modes clears the current photo selection, so decide your cast first. The [one-selfie guide](${gangnamBlogPath('gangnam-style-ai-video-from-one-selfie')}) covers the repeated-subject option in more detail.` },
        ],
      },
      {
        id: 'quality', title: '3. Select quality and review the cost', blocks: [
          { type: 'p', text: 'Framing is fixed at 16:9 landscape to retain the reference composition. Choose 480p for a lower-resolution output or 720p for a higher-resolution file. The choices currently cost {standardCredits} and {hdCredits} MigosAI credits respectively. Check the quote beside the controls before submitting; selecting quality does not itself start a paid generation.' },
          { type: 'p', text: 'The clip follows an approximately 15-second template. Resolution describes output size, not a guarantee of stronger likeness or better anatomy. Choosing 720p cannot reliably repair an unclear reference or a mistaken role assignment. Resolve those issues in the photo previews first.' },
        ],
      },
      {
        id: 'submit', title: '4. Confirm permission and generate once', blocks: [
          { type: 'p', text: 'Check your current account or guest wallet balance and confirm that you own the photos or have the necessary permission. If the interface asks you to sign in, follow that prompt. Then submit once. Uploading, preparing the video and adding the soundtrack are separate processing steps; follow the studio status until the completed file is ready.' },
          { type: 'p', text: `You can check an active job in My videos. If a network request fails, use the explicit retry control and read the message instead of repeatedly starting new versions. A confirmed failed generation returns its reserved credits. The [cost and troubleshooting guide](${gangnamBlogPath('gangnam-style-ai-video-cost-and-fixes')}) explains those cases.` },
        ],
      },
      {
        id: 'review', title: '5. Review the whole MP4 before sharing', blocks: [
          { type: 'p', text: 'Play the completed video and inspect the opening group shot, each solo and the ending. Check that the subjects remain recognizable through transitions. A good still frame is not enough to judge a moving result. New generations include the reference clip’s soundtrack; use the player controls and device volume to listen.' },
          { type: 'p', text: 'Download the MP4 and play that local file as well. This distinguishes a playback setting from a problem in the exported file. Save a copy you can find again before preparing a post. Existing older videos are not automatically given a new soundtrack simply because you reopen their history.' },
        ],
      },
      {
        id: 'publish', title: '6. Match your upload to the destination', blocks: [
          { type: 'p', text: 'The landscape file can be uploaded as a regular YouTube video. YouTube’s Shorts guidance calls for square or vertical files up to three minutes, so a short duration alone does not make this 16:9 output a Short. If you reframe it elsewhere, review the side performers carefully rather than cutting them out unintentionally.' },
          { type: 'p', text: 'Follow the destination’s music and AI-disclosure requirements. YouTube requires disclosure for realistic, meaningfully altered or AI-generated depictions. A generated performance of real people can fall within that guidance. Use a caption that describes the clip as an AI creation rather than footage of something your friends actually did.' },
        ],
      },
    ],
    faqs: [
      { question: 'Do I have to paste a prompt?', answer: 'No. The MigosAI Gangnam Style studio has no prompt input. Choose the cast, supply photos and use the output settings.' },
      { question: 'Can I choose 9:16 in this generator?', answer: 'No. This template currently uses fixed 16:9 landscape. Any later crop or reframing happens in another editor.' },
      { question: 'Should I add the same music again when posting?', answer: 'New files already contain the reference soundtrack. Listen first so you do not accidentally layer a second copy over it.' },
    ],
    sources: [studioSource, shortsHelp, aiDisclosure],
  },
  {
    slug: 'gangnam-style-ai-video-prompt',
    path: gangnamBlogPath('gangnam-style-ai-video-prompt'),
    title: 'Gangnam Style AI Video Prompts: Three Friends, One Selfie and Pets',
    metaTitle: 'Gangnam Style AI Video Prompt: 3 Complete Examples',
    description: 'Copy MigosAI’s full Gangnam Style video prompts for three friends, one selfie and pets. Learn the reference inputs, shot timing and soundtrack workflow.',
    label: '3 Complete Gangnam Style Video Prompts',
    excerpt: 'The complete prompts used by MigosAI for friends, a repeated selfie and pets, with a role map, shot timings and an explanation of the final soundtrack.',
    eyebrow: 'GANGNAM STYLE · PROMPT GUIDE',
    datePublished: GANGNAM_BLOG_UPDATED,
    dateModified: GANGNAM_BLOG_UPDATED,
    intro: 'Here are the **complete Gangnam Style AI video prompts currently used by MigosAI**, with versions for three friends, one selfie and three pets. Each works with a reference video and uploaded photos to assign the cast across group shots and solos. MigosAI supplies these instructions automatically; you can also copy them for an editor that supports the same reference-editing workflow.',
    sections: [
      {
        id: 'reference-first', title: 'Start with the video and photo references', blocks: [
          { type: 'p', text: `These are MigosAI’s own reference-editing directions, not a disclosure of gangnamstyle.io’s private prompt. The template uses Seedance 2.5 with a supplied trio clip. Preview the scene in the [Gangnam Style studio](${studio}) before reading the time map: the sequence is a group shot, three solos and a final group shot.` },
          { type: 'p', text: 'The prompts below use @Video1 for that reference clip. It supplies the background, camera, framing, actions and shot sequence. The uploaded images supply the new performers’ appearance. Merely pasting the words into a text-to-video tool does not attach those assets or reproduce the reference scene.' },
          { type: 'table', caption: 'Reference labels and MigosAI upload roles', headings: ['Reference', 'What to attach', 'Role in the template'], rows: [
            ['@Video1', 'The trio reference video', 'Scene, movement and shot timing'],
            ['@Image1', 'The Middle photo', 'Center performer and first solo'],
            ['@Image2', 'The Right photo', 'Viewer’s right and second solo'],
            ['@Image3', 'The Left photo', 'Viewer’s left and third solo'],
          ] },
          { type: 'p', text: 'Friends and pet modes use three separate photos. The selfie mode uses only @Image1, repeated across all three roles. In another editor, attach the assets in the matching order and check its supported reference syntax and editing mode before submitting.' },
        ],
      },
      {
        id: 'identity-map', title: 'The position and timing map', blocks: [
          { type: 'p', text: 'The instructions identify performers by screen position and time, rather than by the original cast’s clothes. This matters when a solo fills the frame or someone returns after a cut. Left and right always mean the viewer’s left and right.' },
          { type: 'table', caption: 'Shot assignments for this reference clip', headings: ['Time in the reference', 'Intended assignment'], rows: [
            ['0–2 seconds', 'Group: left @Image3, center @Image1, right @Image2'],
            ['2–4.9 seconds', 'First solo: @Image1'],
            ['4.9–8.4 seconds', 'Second solo: @Image2'],
            ['8.4–12.3 seconds', 'Third solo: @Image3'],
            ['12.3 seconds to the final frame', 'Group: left @Image3, center/front @Image1, right @Image2'],
          ] },
          { type: 'note', text: 'These time codes belong to this particular reference clip. If you use another video, watch it and rewrite the shot boundaries and role assignments. For the selfie version, every @Image2 and @Image3 assignment becomes @Image1.' },
        ],
      },
      {
        id: 'generic-example', title: '1. Full prompt for three friends', blocks: [
          { type: 'p', text: 'Use this version with one photo per person. Upload the center performer first, the viewer’s right performer second and the viewer’s left performer third. Each photo is the reference for that person’s face, hair and clothes throughout the clip. Select and copy the complete text below when using a compatible editor.' },
          { type: 'code', label: 'Complete three-friends video prompt', text: gangnamStylePrompt('friends') },
          { type: 'p', text: `For MigosAI, select Gangnam Style trio and put each image into its labeled slot; the prompt is already configured. Use the [photo preparation guide](${gangnamBlogPath('best-photos-for-gangnam-style-ai-video')}) to avoid unclear faces, group photos and unsuitable crops.` },
        ],
      },
      {
        id: 'selfie-pets', title: '2. Full prompt for one selfie in all three roles', blocks: [
          { type: 'p', text: 'Use one clear adult portrait as @Image1. This version asks for three separate copies of the same person, so all group positions and every solo use the same identity. It also explicitly preserves that person’s face, hair and clothes across the copies.' },
          { type: 'code', label: 'Complete single-selfie video prompt', text: gangnamStylePrompt('selfie') },
          { type: 'p', text: `In MigosAI, choose Three of you and upload one selfie. You do not need to upload the same file three times. The [single-selfie guide](${gangnamBlogPath('gangnam-style-ai-video-from-one-selfie')}) explains the photo selection and review steps.` },
        ],
      },
      {
        id: 'pet-prompt', title: '3. Full prompt for three pets', blocks: [
          { type: 'p', text: 'Attach one individual animal photo to each image reference, using the same Middle, Right and Left order. The pet version preserves species, face, fur markings and size. It asks the model to interpret human expressions and hand gestures as head and front-paw movements with coherent animal anatomy.' },
          { type: 'code', label: 'Complete three-pet video prompt', text: gangnamStylePrompt('pets') },
          { type: 'p', text: `Choose Pet trio in MigosAI to apply this version automatically. Review paws, limbs and species consistency in the result; the instruction expresses the intended behavior but does not guarantee perfect anatomy. See the [pet video guide](${gangnamBlogPath('gangnam-style-ai-pet-video')}) for suitable reference photos.` },
        ],
      },
      {
        id: 'settings-and-audio', title: 'Settings and why the prompts say to remove audio', blocks: [
          { type: 'p', text: 'The current MigosAI template uses Seedance 2.5 reference editing, fixed 16:9 landscape framing and a roughly 15-second reference. You choose 480p or 720p. The reference provides the composition and timing; higher resolution changes output size, not the identity map or the intended shot order.' },
          { type: 'p', text: '“Remove all audio tracks” applies to the model’s video-generation stage. MigosAI requests a silent visual edit and then uses an FFmpeg processing step to merge the reference clip’s soundtrack into the finished video. New completed MigosAI results therefore include sound. The prompt does not ask the model to recreate the music.' },
          { type: 'p', text: `If you copy these prompts into another tool, that tool will not automatically run MigosAI’s soundtrack step. Add the intended audio separately using its editing controls or your own post-production workflow. The [soundtrack guide](${gangnamBlogPath('gangnam-style-ai-video-music')}) explains playback and the audio included in this template.` },
        ],
      },
      {
        id: 'use-the-prompts', title: 'How to use the prompts', blocks: [
          { type: 'ol', items: [
            'Choose the version that matches your cast: three people, one repeated adult selfie or three pets.',
            'In a compatible video editor, attach the reference clip and photos. Use its reference-editing workflow and match the asset labels to the prompt.',
            'Keep the time map only if you are using this exact reference. For a different clip, update the positions and solo timings after watching it.',
            'Generate the visual edit, review the entire clip and add the desired soundtrack separately if your tool does not do that for you.',
          ] },
          { type: 'p', text: `In the [MigosAI studio](${studio}), the reference, matching prompt and soundtrack processing are already set up. Choose your mode, photos and quality, review the displayed credits and generate. There is no prompt text box. The [step-by-step walkthrough](${gangnamBlogPath('how-to-make-gangnam-style-ai-video')}) covers the available controls.` },
        ],
      },
      {
        id: 'evaluate-prompt', title: 'What to check before sharing the result', blocks: [
          { type: 'ul', items: [
            'Opening and closing groups: are all three foreground performers replaced in the intended positions?',
            'Each solo: does the correct person or pet appear, including immediately after a camera transition?',
            'Appearance: do faces, hair, clothing or fur markings stay recognizable throughout?',
            'Scene and sound: does the clip retain the reference sequence, and does the downloaded final file play with its soundtrack?',
          ] },
          { type: 'p', text: 'An instruction is a target, not a guarantee for every generated frame. If a solo has the wrong person, inspect the image order and role map. If a face is unclear, improve the source photo. If using another editor, confirm it actually received the video reference. Adding more adjectives does not resolve those input problems.' },
        ],
      },
    ],
    faqs: [
      { question: 'Are these the actual prompts used by MigosAI?', answer: 'Yes. The three full prompt blocks are generated from the same prompt function used by the current MigosAI template. They are our reference-editing directions; we do not have gangnamstyle.io’s private prompt.' },
      { question: 'Where do I paste a prompt in MigosAI?', answer: 'You do not need to paste one. This template automatically selects the matching instructions when you choose Gangnam Style trio, Three of you or Pet trio. Upload your photos and choose the output quality.' },
      { question: 'What do @Video1 and @Image1 mean?', answer: '@Video1 identifies the supplied reference video. @Image1 identifies the first uploaded photo, assigned to the center and first solo. In friends and pet modes, @Image2 is the viewer’s right and @Image3 is the viewer’s left.' },
      { question: 'Why does the prompt remove audio if the final video has sound?', answer: 'The prompt controls the visual generation stage. MigosAI subsequently merges the reference soundtrack with the generated video using FFmpeg. Another tool needs its own audio step when using the same prompt.' },
      { question: 'Will these prompts work with any clip or video tool?', answer: 'No. The editor must support video reference editing and the relevant image references. The time codes match this specific trio clip; adapt the shot map and asset labels when using another reference or tool. Results can still vary.' },
    ],
    sources: [
      { label: 'Kie: Seedance 2.5 reference workflow documentation', url: 'https://docs.kie.ai/market/bytedance/seedance-2-5' },
      { label: 'fal: Seedance 2.5 reference-to-video and editing inputs', url: 'https://fal.ai/models/bytedance/seedance-2.5/us/reference-to-video/api' },
      aiDisclosure, studioSource,
    ],
  },
  {
    slug: 'gangnam-style-ai-video-music',
    path: gangnamBlogPath('gangnam-style-ai-video-music'),
    title: 'Gangnam Style AI Video Music: What Sound Is Included?',
    metaTitle: 'Gangnam Style AI Video Music and Soundtrack Explained',
    description: 'New MigosAI Gangnam Style videos include the reference clip’s soundtrack. Learn how it is added, how to check playback and what that means when sharing.',
    label: 'Music and Soundtrack Guide',
    excerpt: 'Understand the template soundtrack, troubleshoot an apparently silent player, and avoid confusing included audio with a music-use licence.',
    eyebrow: 'GANGNAM STYLE · MUSIC AND PLAYBACK',
    datePublished: GANGNAM_BLOG_UPDATED,
    dateModified: GANGNAM_BLOG_UPDATED,
    intro: 'New MigosAI Gangnam Style videos include **the same soundtrack as the trio reference clip**. The service adds it to the generated picture before delivering the finished MP4. This describes the template audio, not a complete copy of PSY’s original song or a promise of permission to use music on every publishing platform.',
    sections: [
      {
        id: 'which-audio', title: 'Separate the song, the reference clip and your result', blocks: [
          { type: 'p', text: 'PSY’s Gangnam Style is the original song associated with the well-known music video. The short trio reference shown in this generator is a different piece of media. Its soundtrack is the audio attached to new MigosAI template results. The title alone does not establish that a short sample contains the complete song, a particular official master or a specific licensed remix.' },
          { type: 'p', text: `Listen to the reference when deciding whether the template suits your idea. If you want the historical recording, use the official PSY video linked in the sources. For the visual distinction between the original and the AI template, see [what Gangnam Style AI is](${gangnamBlogPath('what-is-gangnam-style')}).` },
        ],
      },
      {
        id: 'automatic-audio', title: 'The soundtrack is added during processing', blocks: [
          { type: 'p', text: 'The new-generation workflow prepares the video and then combines it with the template soundtrack using FFmpeg processing. You do not need to upload a separate audio file or add a music instruction to your photos. The studio may show an “Adding the template soundtrack” status while this stage is still running.' },
          { type: 'p', text: 'Wait for the completed MP4 rather than treating an intermediate video as the final download. The result is a short template clip, approximately 15 seconds long, with picture and audio packaged together. Older generation records retain their original behaviour; reopening a previously silent result does not automatically create a new version with sound.' },
        ],
      },
      {
        id: 'check-playback', title: 'Check playback before deciding the file is silent', blocks: [
          { type: 'p', text: 'A quiet player can reflect its playback settings rather than a missing audio track. The page’s hero example has a sound toggle, while completed results use ordinary video controls. Click play, check that the player is not muted and confirm the device is using the speakers or headphones you expect. A browser may restrict unsolicited audible playback.' },
          { type: 'ol', items: [
            'Wait until the job is completed, then play the result in the studio.',
            'Check the player’s volume and your device output, including connected headphones.',
            'Download the MP4 and play it in another ordinary media player.',
            'If a new completed file is still silent, keep its generation ID and contact support with that result.',
          ] },
          { type: 'p', text: 'A library thumbnail is not an audio test. Open the actual video preview before drawing a conclusion.' },
        ],
      },
      {
        id: 'publishing-audio', title: 'Included audio and publishing permission are separate', blocks: [
          { type: 'p', text: 'A downloadable file containing music does not, by itself, establish what uses a rights holder permits. YouTube’s copyright guidance treats sound recordings and musical compositions as protected types of content. Its Shorts upload instructions also warn that externally produced videos containing protected material can receive Content ID claims or copyright removal requests.' },
          { type: 'p', text: 'Check the rules and permissions relevant to where you intend to publish. Do not describe the template as copyright-free, universally licensed or guaranteed to avoid claims. If a platform flags the audio, read the actual notice rather than assuming that AI-generated visuals remove a music restriction. Keep your original download before editing any version.' },
        ],
      },
      {
        id: 'editing-sharing', title: 'Avoid duplicate music when preparing a post', blocks: [
          { type: 'p', text: 'Listen before adding another track in your publishing app. Layering a second copy over the included audio can create an echo or an obvious timing mismatch. If you choose a different permitted soundtrack in another editor, decide which audio should remain audible and preview the exported file again. A change to the music does not change the generated faces or choreography.' },
          { type: 'p', text: `Start a new clip in the [Gangnam Style studio](${studio}), or follow the [full creation guide](${gangnamBlogPath('how-to-make-gangnam-style-ai-video')}) if you have not made one yet. The [format guide](${gangnamBlogPath('gangnam-style-ai-video-format-resolution')}) explains how the fixed landscape frame affects sharing, and the [cost and fixes guide](${gangnamBlogPath('gangnam-style-ai-video-cost-and-fixes')}) covers failed or unfinished jobs.` },
        ],
      },
    ],
    faqs: [
      { question: 'Do new MigosAI results include sound?', answer: 'Yes. New Gangnam Style generations receive the trio reference clip’s soundtrack before the completed MP4 is delivered.' },
      { question: 'Is it the full original PSY song?', answer: 'The feature provides the soundtrack from the short reference clip. It should not be described as a complete song download or a particular official recording without separately identifying that audio.' },
      { question: 'Will my older silent video gain sound automatically?', answer: 'No. Existing records are not automatically remade when the soundtrack workflow changes. Check the actual file you downloaded.' },
      { question: 'Can I upload my own music in this template?', answer: 'There is no custom audio-upload control in the Gangnam Style studio. You can make separate edits to your downloaded file using another editor and audio you are permitted to use.' },
    ],
    sources: [studioSource, officialVideo, copyrightHelp, shortsHelp],
  },
];
