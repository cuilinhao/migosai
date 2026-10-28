import type { BlogPost } from '../blog';
import { gangnamBlogPath, GANGNAM_BLOG_UPDATED } from './shared';

export const practicalPosts: BlogPost[] = [
  {
    slug: 'best-photos-for-gangnam-style-ai-video',
    path: gangnamBlogPath('best-photos-for-gangnam-style-ai-video'),
    title: 'Best Photos for a Gangnam Style AI Video: A Practical Upload Guide',
    metaTitle: 'Best Photos for Gangnam Style AI Video | Upload Guide',
    description: 'Choose clear reference photos, assign the Middle, Right and Left roles, and avoid common upload mistakes before making a Gangnam Style AI video.',
    label: 'Choose the Best Photos',
    excerpt: 'A useful photo checklist for recognizable faces, clear role assignments and fewer avoidable upload problems.',
    eyebrow: 'GANGNAM STYLE AI · PHOTO GUIDE',
    datePublished: GANGNAM_BLOG_UPDATED,
    dateModified: GANGNAM_BLOG_UPDATED,
    intro: 'The best photos for a Gangnam Style AI video show **one clearly visible subject per image**, facing the camera with an unobstructed face. For a friends trio, prepare three separate photos and upload them in **Middle, Right, Left** order. Better references give the generator clearer information, although they cannot guarantee a perfect likeness in every frame.',
    sections: [
      {
        id: 'choose-readable-faces',
        title: 'Choose the photo you can recognize at a glance',
        blocks: [
          { type: 'p', text: 'Start with an ordinary, well-lit portrait. You should be able to distinguish the eyes, mouth, hairline and overall face shape without zooming far in. A simple background helps you judge those details, but you do not need a studio backdrop or matching backgrounds for all three people.' },
          { type: 'p', text: 'Compare two candidate photos at the same size. If one has a clearer face but a less interesting location, use the clearer face. The template supplies the moving scene; the upload supplies the person. A tiny face inside a beautiful holiday landscape gives the generator less useful identity information.' },
        ],
      },
      {
        id: 'remove-ambiguity',
        title: 'Keep one person and their defining details visible',
        blocks: [
          { type: 'ul', items: [
            'Use one person per file. Crop a group photograph into separate portraits only if each resulting face remains clear.',
            'Avoid sunglasses, hands over the face, heavy shadows and motion blur. Keep hair visible rather than cropping tightly around the eyes and mouth.',
            'Choose a photo whose clothes and hairstyle you want represented. The reference is used for appearance beyond just the face.',
            'Skip collages, decorative stickers and strong beauty filters that hide the original facial details.',
          ] },
          { type: 'p', text: 'A head-and-shoulders or upper-body picture is a practical starting point: it leaves room for hair and clothing while keeping the face readable. Do not stretch a narrow crop to make it wider. Distortion becomes part of the reference the generator sees.' },
        ],
      },
      {
        id: 'assign-the-roles',
        title: 'Assign the three roles before uploading',
        blocks: [
          { type: 'table', caption: 'Photo slots and intended performance order', headings: ['Upload slot', 'Group position', 'Solo turn'], rows: [
            ['Middle', 'Center', 'First'],
            ['Right', "Viewer's right", 'Second'],
            ['Left', "Viewer's left", 'Third'],
          ] },
          { type: 'p', text: 'The upload order is not left to right across the finished picture. Decide who should take the first solo, place that photo in Middle, then fill Right and Left. Check the thumbnails once more before submitting. A correct role assignment is easier to establish before generation than to diagnose from a fast camera transition afterward.' },
          { type: 'p', text: 'If you want the same person in all three roles, use the dedicated [one-selfie mode](/gangnam-style-ai-video-generator/blog/gangnam-style-ai-video-from-one-selfie). For animals, follow the [pet photo guide](/gangnam-style-ai-video-generator/blog/gangnam-style-ai-pet-video).' },
        ],
      },
      {
        id: 'check-files',
        title: 'Check the files and permission',
        blocks: [
          { type: 'p', text: 'The uploader accepts **JPEG, PNG and WebP**, up to **10 MB per photo**. Export an unsupported phone image into one of those formats; changing only the filename does not convert it. If a file is too large, export a smaller copy while checking that the facial details remain visible.' },
          { type: 'p', text: 'Each side must be **301–5,999 pixels**, with width divided by height strictly above **0.4** and below **2.5**. Crop extremely narrow or wide images while keeping the face clear.' },
          { type: 'p', text: 'Use photos you own or have permission to use, and confirm consent. Check your current account or guest wallet balance; follow any sign-in prompt shown. Review the thumbnails before generating to catch the wrong file, an accidental duplicate or an obscured face.' },
        ],
      },
      {
        id: 'review-the-result',
        title: 'Review the whole clip before choosing another photo',
        blocks: [
          { type: 'p', text: 'Open the [Gangnam Style studio](/gangnam-style-ai-video-generator#studio), choose 480p or 720p and check the displayed credit cost. The current output is a landscape 16:9 MP4 based on a 15-second reference, with its original soundtrack added automatically. The generated clip can be slightly shorter.' },
          { type: 'p', text: 'After delivery, inspect the opening group, all three solos and the closing group. If only one person looks unclear, consider replacing that reference rather than changing every photo at once. Higher resolution does not guarantee a better identity match. Each new generation has its own cost; the [cost and fixes guide](/gangnam-style-ai-video-generator/blog/gangnam-style-ai-video-cost-and-fixes) explains the difference between a failed task and a completed result you want to improve.' },
        ],
      },
    ],
    faqs: [
      { question: 'Can I upload one group photo for the friends trio?', answer: 'Friends mode requires three image uploads. Use one clear person per file so each slot has an unambiguous reference. If cropping a group picture makes the faces tiny or blurry, choose separate portraits.' },
      { question: 'Do all three photos need the same background?', answer: 'No. Prioritize readable faces and visible hair and clothes. The template supplies the scene, so matching the original photo backgrounds is unnecessary.' },
      { question: 'Does 720p fix a blurry reference?', answer: 'No resolution setting can reliably restore missing identity information. Start with a clearer source photo; 720p changes the output resolution, not the quality of the uploaded reference.' },
      { question: 'Will a good photo produce an exact likeness?', answer: 'A clear reference helps, but AI appearance can still vary between shots. Review the whole delivered clip rather than judging only its first frame.' },
    ],
    sources: [
      { label: 'Gangnam Style studio: photo requirements and role labels', url: '/gangnam-style-ai-video-generator#studio' },
      { label: 'MigosAI pricing and account credits', url: '/pricing' },
      { label: 'Refund policy: failed generations and completed AI results', url: '/refund-policy' },
    ],
  },
  {
    slug: 'gangnam-style-ai-video-from-one-selfie',
    path: gangnamBlogPath('gangnam-style-ai-video-from-one-selfie'),
    title: 'How to Make a Gangnam Style AI Video from One Selfie',
    metaTitle: 'Gangnam Style AI Video from One Selfie | Three of You',
    description: 'Use one clear selfie to create three versions of yourself in the Gangnam Style template. Follow the upload, resolution, credits and result-review steps.',
    label: 'Make Three of Yourself',
    excerpt: 'Use the Three of you mode to fill every role with one identity, without preparing three different portraits.',
    eyebrow: 'GANGNAM STYLE AI · SELFIE TUTORIAL',
    datePublished: GANGNAM_BLOG_UPDATED,
    dateModified: GANGNAM_BLOG_UPDATED,
    intro: 'To make a Gangnam Style AI video from one selfie, select **Three of you** in the studio and upload one clear adult portrait. The template uses that single identity for three separate performers, including all three solo turns. You do not need to duplicate the photo or write a prompt.',
    sections: [
      {
        id: 'understand-selfie-mode',
        title: 'What one selfie controls',
        blocks: [
          { type: 'p', text: 'Selfie mode is designed for the joke of appearing beside yourself. The same uploaded face, hair and clothes guide all three copies. It does not assign three different outfits or let you direct each copy independently. The reference performance provides the group shots, camera movement and sequence of close-ups.' },
          { type: 'p', text: 'Choose this mode when you want one recognizable identity repeated across the scene. If you want yourself with two friends, switch to the trio mode and provide three portraits instead. Those photos have distinct Middle, Right and Left roles, explained in the [photo selection guide](/gangnam-style-ai-video-generator/blog/best-photos-for-gangnam-style-ai-video).' },
        ],
      },
      {
        id: 'pick-one-reference',
        title: 'Choose the appearance you want repeated',
        blocks: [
          { type: 'p', text: 'Use a recent, well-lit photo with one person facing the camera. Keep both eyes and the mouth unobstructed, leave the hairstyle visible, and avoid sunglasses or a hand across the face. A portrait with some shoulders and clothing gives more context than a crop containing only facial features.' },
          { type: 'p', text: 'A mirror selfie can contain distractions such as a phone covering the face or a second reflected figure. Check the actual image rather than assuming every selfie is suitable. If the phone hides important details, take a simple camera-facing portrait instead. The upload does not need to have been taken with a front-facing camera.' },
          { type: 'p', text: 'Save it as JPEG, PNG or WebP at no more than 10 MB. Keep an unedited copy so you can try a different crop later without repeatedly compressing the same file.' },
        ],
      },
      {
        id: 'make-the-video',
        title: 'Create your three-person version',
        blocks: [
          { type: 'ol', items: [
            'Open the [Gangnam Style studio](/gangnam-style-ai-video-generator#studio) and choose Three of you before adding your photo.',
            'Upload the portrait and inspect its thumbnail. Confirm it is the right person and the face is clearly visible.',
            'Select 480p or 720p. The current template uses fixed 16:9 landscape framing.',
            'Review the quote against your current account or guest wallet balance and confirm permission to use the photo. Follow any sign-in prompt shown.',
            'Submit once and follow the task status. Download the MP4 when generation, soundtrack preparation and review are complete.',
          ] },
          { type: 'p', text: 'Selecting another mode clears the current photo selection, so make the mode choice first. If you return to the page while a task is active, check the existing task before starting another. A new generation is a separate purchase using your account credits.' },
        ],
      },
      {
        id: 'choose-settings',
        title: 'Check the format, sound and cost',
        blocks: [
          { type: 'p', text: 'A 480p generation costs **{standardCredits} credits**; a 720p generation costs **{hdCredits} credits**. Selfie mode uses one upload, but the output is still the complete trio scene. It does not become a cheaper single-person clip because fewer photos are needed.' },
          { type: 'p', text: 'The video follows a 15-second reference and can finish slightly shorter. The reference clip’s soundtrack is added automatically, so you do not need to upload an audio file. Check playback with sound on once it is ready. For the practical difference between the two resolution settings, see the [format and resolution guide](/gangnam-style-ai-video-generator/blog/gangnam-style-ai-video-format-resolution).' },
        ],
      },
      {
        id: 'check-every-copy',
        title: 'Review all three copies, not just one close-up',
        blocks: [
          { type: 'p', text: 'Pause the opening group shot and check each copy, then watch the three solos and the final group. The intended identity stays the same throughout, but AI can vary facial features, clothing details or transitions. A strong first solo is not proof that every other shot matches equally well.' },
          { type: 'p', text: 'If the face is consistently hard to recognize, start by choosing a clearer portrait. If a task is still processing or needs support review, keep its generation ID rather than repeatedly submitting. The [cost and fixes article](/gangnam-style-ai-video-generator/blog/gangnam-style-ai-video-cost-and-fixes) covers that distinction and explains when failed-generation credits are returned.' },
        ],
      },
    ],
    faqs: [
      { question: 'Do I need to upload the selfie three times?', answer: 'No. Three of you mode accepts one photo and uses it for all three performers. Friends and pets modes use three uploads.' },
      { question: 'Can the three copies wear different clothes?', answer: 'The current selfie mode uses one appearance reference for every copy. There is no separate clothing control for each performer.' },
      { question: 'Does the finished selfie video include sound?', answer: 'Yes. New videos automatically receive the reference clip’s soundtrack during preparation. You do not need to add your own audio to complete the template.' },
      { question: 'Is one-selfie mode free or discounted?', answer: 'It uses the same resolution-based credits as the other modes: {standardCredits} credits at 480p or {hdCredits} credits at 720p. Check the studio quote before submitting.' },
    ],
    sources: [
      { label: 'Gangnam Style studio: Three of you mode and settings', url: '/gangnam-style-ai-video-generator#studio' },
      { label: 'MigosAI credit packs and subscriptions', url: '/pricing' },
      { label: 'Refund policy: generation credits', url: '/refund-policy' },
    ],
  },
  {
    slug: 'gangnam-style-ai-pet-video',
    path: gangnamBlogPath('gangnam-style-ai-pet-video'),
    title: 'How to Make a Gangnam Style AI Pet Video with Three Photos',
    metaTitle: 'Gangnam Style AI Pet Video | Three-Photo Guide',
    description: 'Make a Gangnam Style pet trio with three clear animal photos. Learn the role order, useful fur and face details, output settings and result checks.',
    label: 'Create a Pet Trio',
    excerpt: 'Prepare three animal references and check the details that matter: faces, fur markings, role order and movement.',
    eyebrow: 'GANGNAM STYLE AI · PET TUTORIAL',
    datePublished: GANGNAM_BLOG_UPDATED,
    dateModified: GANGNAM_BLOG_UPDATED,
    intro: 'To make a Gangnam Style AI pet video, choose **Pet trio** and upload three clear animal photos in **Middle, Right, Left** order. The template aims to retain each pet’s species, face and fur markings while adapting the performance into animal movements. It is an AI interpretation, so recognizable markings and coherent movement still need checking in the finished clip.',
    sections: [
      {
        id: 'choose-pet-portraits',
        title: 'Choose photos that distinguish the three pets',
        blocks: [
          { type: 'p', text: 'Use one pet per image, with its face and characteristic features visible. For a dark-coated animal, choose lighting that separates the eyes and muzzle from the surrounding fur. For a pale animal, avoid a photo where bright light removes the detail around its nose, ears or coat.' },
          { type: 'p', text: 'Look for the details you use to recognize your own pet: an uneven facial patch, a white chest, ear shape or distinctive muzzle. Keep those features in the crop. A small animal photographed from across a room may be obvious to you from context, while leaving very little useful detail in the actual reference.' },
          { type: 'p', text: 'Choose a calm, clear moment rather than a motion-blurred action shot. You do not need to photograph your pet performing the movement; the template supplies it. Avoid placing a human hand across the face or including another animal that could confuse the reference.' },
        ],
      },
      {
        id: 'place-each-pet',
        title: 'Set the role order deliberately',
        blocks: [
          { type: 'table', caption: 'Pet trio upload order', headings: ['Slot', 'Intended role'], rows: [
            ['Middle', 'Center of the group and first solo'],
            ['Right', "Viewer's right and second solo"],
            ['Left', "Viewer's left and third solo"],
          ] },
          { type: 'p', text: 'Decide which pet gets each turn before uploading. If two animals look similar, use references with clearly visible distinguishing marks and double-check the thumbnails. The first file belongs in the center role, even though the first animal you see when reading a group picture from left to right is on the left.' },
          { type: 'p', text: 'Pet trio requires three photo slots. The [one-selfie option](/gangnam-style-ai-video-generator/blog/gangnam-style-ai-video-from-one-selfie) is a separate mode designed for a human identity repeated three times; it is not the dedicated pet workflow.' },
        ],
      },
      {
        id: 'upload-and-generate',
        title: 'Upload and check the quote',
        blocks: [
          { type: 'ol', items: [
            'Open the [Gangnam Style studio](/gangnam-style-ai-video-generator#studio) and select Pet trio.',
            'Add three JPEG, PNG or WebP photos, each no larger than 10 MB. Inspect every preview before continuing.',
            'Choose 480p or 720p, check your current account or guest wallet balance, and confirm permission to use the photos. Follow any sign-in prompt shown.',
            'Check the credit quote and submit once. Follow the task status until the prepared video is available.',
          ] },
          { type: 'p', text: 'A pet video costs **{standardCredits} credits at 480p** or **{hdCredits} credits at 720p**. Those are generation credits from the same MigosAI account used elsewhere on the site. Preparing a better photo before submission is more useful than treating repeated paid attempts as a substitute for a clear reference.' },
        ],
      },
      {
        id: 'what-to-expect',
        title: 'Expect the template scene and its soundtrack',
        blocks: [
          { type: 'p', text: 'The output is a landscape 16:9 MP4 based on the 15-second reference performance; its finished duration can be slightly shorter. The reference soundtrack is added automatically. There is no separate audio upload or custom song selector in this workflow.' },
          { type: 'p', text: 'The intended pet treatment translates expressions and gestures into head and front-paw movement while retaining animal anatomy. That direction does not promise that every species, pose or transition will render equally well. Use the actual result to assess the movement rather than assuming the preview demonstrates an identical outcome for your pet.' },
        ],
      },
      {
        id: 'review-the-pet-video',
        title: 'Check markings and movement across the whole clip',
        blocks: [
          { type: 'p', text: 'Watch the opening group, each solo and the closing group. Check that the intended pet takes each turn, that prominent markings remain recognizable, and that paws, ears and faces move coherently. The quick camera changes can hide a mismatch when you only glance at the first frame.' },
          { type: 'p', text: 'If one pet is unclear, compare that result with its uploaded photo and change only the weak reference for a future attempt. For file or crop problems, use the [photo checklist](/gangnam-style-ai-video-generator/blog/best-photos-for-gangnam-style-ai-video). If the task has failed or remains under review, follow the [cost and fixes guide](/gangnam-style-ai-video-generator/blog/gangnam-style-ai-video-cost-and-fixes) before creating another paid job.' },
        ],
      },
    ],
    faqs: [
      { question: 'Can I use photos of different kinds of pets?', answer: 'The pet mode takes three animal references and aims to preserve each subject’s species and appearance. Mixed references can be tried, but the generator does not guarantee equally consistent results for every combination.' },
      { question: 'Can I use one photo containing all three pets?', answer: 'The mode requires three separate uploads. Use one clearly visible animal per image so each performance role has its own reference.' },
      { question: 'Will the pet video turn the animals into people?', answer: 'The template directs animal expressions and front-paw movements while retaining species and anatomy. AI errors are still possible, so inspect the finished clip rather than assuming that direction is a guarantee.' },
      { question: 'Do I need to add music after downloading?', answer: 'The reference clip’s soundtrack is added automatically to new videos. Play the completed file with sound on to check it before using it elsewhere.' },
    ],
    sources: [
      { label: 'Gangnam Style studio: Pet trio and upload requirements', url: '/gangnam-style-ai-video-generator#studio' },
      { label: 'MigosAI pricing', url: '/pricing' },
      { label: 'Refund policy: failed tasks and AI result variation', url: '/refund-policy' },
    ],
  },
  {
    slug: 'gangnam-style-ai-video-format-resolution',
    path: gangnamBlogPath('gangnam-style-ai-video-format-resolution'),
    title: 'Gangnam Style AI Video Format and Resolution: 480p or 720p?',
    metaTitle: 'Gangnam Style AI Video Format | 16:9, 480p and 720p',
    description: 'Compare 480p and 720p Gangnam Style videos, understand the fixed 16:9 frame and 15-second reference, and plan sensible crops without losing the trio.',
    label: 'Choose Format and Resolution',
    excerpt: 'Understand the current landscape format, output resolution, reference duration and included soundtrack before spending credits.',
    eyebrow: 'GANGNAM STYLE AI · OUTPUT SETTINGS',
    datePublished: GANGNAM_BLOG_UPDATED,
    dateModified: GANGNAM_BLOG_UPDATED,
    intro: 'The current Gangnam Style generator produces a **16:9 landscape MP4** in **480p or 720p**, using a 15-second reference performance and automatically adding its soundtrack. Choose 480p for the lower credit cost or 720p for more output pixels. Neither setting guarantees a stronger likeness, and the finished clip can be slightly shorter than the reference.',
    sections: [
      {
        id: 'compare-resolution',
        title: 'Compare the two available settings',
        blocks: [
          { type: 'table', caption: 'Current Gangnam Style output options', headings: ['Setting', '480p Standard', '720p HD'], rows: [
            ['Aspect ratio', '16:9 landscape', '16:9 landscape'],
            ['Reference duration', '15 seconds', '15 seconds'],
            ['Output file', 'MP4 with reference soundtrack', 'MP4 with reference soundtrack'],
            ['Credits per generation', '{standardCredits}', '{hdCredits}'],
          ] },
          { type: 'p', text: '480p and 720p describe the output resolution, not two different performances. Both use the same three-person scene and photo-role arrangement. Choose based on how much image detail you need and what you want to spend, then confirm the current quote in the [studio](/gangnam-style-ai-video-generator#studio).' },
          { type: 'p', text: 'If you are deciding whether your references work well together, the lower-cost option may be a reasonable first attempt. A later 720p generation is another AI result, however, not a guaranteed identical copy of the 480p clip with extra pixels.' },
        ],
      },
      {
        id: 'why-landscape',
        title: 'Why the frame stays landscape',
        blocks: [
          { type: 'p', text: 'The reference contains an opening group, a sequence of solo close-ups and a closing group. The fixed 16:9 frame preserves room for the performers on both sides. There is currently no portrait, square or custom-ratio choice in this template.' },
          { type: 'p', text: 'A portrait source photo is still fine: its shape does not determine the finished video shape. The photo identifies the subject, while the template supplies the output framing. Choose a clear reference instead of stretching a portrait into landscape. The [photo guide](/gangnam-style-ai-video-generator/blog/best-photos-for-gangnam-style-ai-video) explains what to keep visible.' },
        ],
      },
      {
        id: 'duration-and-sound',
        title: 'Understand the duration and included sound',
        blocks: [
          { type: 'p', text: 'The studio calls this a 15-second template because it follows a reference of that length. The finished generated video can be slightly shorter. Do not plan an edit that depends on receiving exactly 15.000 seconds before checking the downloaded file.' },
          { type: 'p', text: 'The reference soundtrack is added automatically after video generation. The task may therefore continue preparing after the visual generation stage. Wait until the final result is ready, then watch it with sound enabled. There is no need to submit a second job just because the status says the soundtrack is being added.' },
        ],
      },
      {
        id: 'plan-a-crop',
        title: 'Plan any portrait edit around the group shots',
        blocks: [
          { type: 'p', text: 'If you need a portrait composition later, preview the entire clip inside your intended crop. Centering a narrow frame can preserve a solo while cutting off the left and right performers in the group scenes. Check every camera transition before deciding that one fixed crop works throughout.' },
          { type: 'p', text: 'Keeping the whole landscape picture inside a taller canvas is another editing choice, although it leaves space above and below. Cropping does not create missing detail, and stretching the picture changes faces and body proportions. Save the original downloaded MP4 before experimenting so you can return to the full scene.' },
          { type: 'p', text: 'A short landscape video is not automatically a YouTube Short or a ready-made portrait upload. Check the destination’s current format and music requirements separately; the generator’s download format alone does not establish upload eligibility.' },
        ],
      },
      {
        id: 'choose-before-submitting',
        title: 'Make the resolution decision before submitting',
        blocks: [
          { type: 'p', text: 'Review the three photo thumbnails, the selected resolution and the credit quote together. A higher setting cannot reliably correct an obscured face, a mixed-up upload slot or an unsuitable reference. For [one-selfie videos](/gangnam-style-ai-video-generator/blog/gangnam-style-ai-video-from-one-selfie), the same principle applies to the single photo reused across all three roles.' },
          { type: 'p', text: 'The studio does not turn an active task into a different-resolution task. Treat a later generation with changed settings as a separate credit purchase. If the current job is unresolved, check its status first; the [cost and fixes guide](/gangnam-style-ai-video-generator/blog/gangnam-style-ai-video-cost-and-fixes) explains how to distinguish a paid new attempt from recovery of an existing task.' },
        ],
      },
    ],
    faqs: [
      { question: 'Can I generate a 9:16 Gangnam Style video directly?', answer: 'The current template uses fixed 16:9 landscape framing. You can edit the downloaded file afterward, but check that any crop keeps the performers you want visible.' },
      { question: 'Is 720p guaranteed to look more like my photos?', answer: 'No. It provides a higher output resolution, but identity matching and consistency are separate aspects of the generated result.' },
      { question: 'Will the download be exactly 15 seconds?', answer: 'It follows a 15-second reference, but the generated clip can be slightly shorter. Check the actual file before planning precise timing in another edit.' },
      { question: 'Does choosing 480p remove the soundtrack?', answer: 'No. Both current resolution options include the automatically added reference soundtrack.' },
    ],
    sources: [
      { label: 'Gangnam Style studio: current format, resolution and credit quote', url: '/gangnam-style-ai-video-generator#studio' },
      { label: 'MigosAI pricing and available credits', url: '/pricing' },
      { label: 'Refund policy: completed generations', url: '/refund-policy' },
    ],
  },
  {
    slug: 'gangnam-style-ai-video-cost-and-fixes',
    path: gangnamBlogPath('gangnam-style-ai-video-cost-and-fixes'),
    title: 'Gangnam Style AI Video Cost, Failed Jobs and Common Fixes',
    metaTitle: 'Gangnam Style AI Video Cost and Fixes | Credits Guide',
    description: 'Check Gangnam Style generation credits, fix upload problems, understand task statuses, and distinguish failed-generation credit returns from cash refunds.',
    label: 'Credits, Costs and Fixes',
    excerpt: 'Know what a new generation costs and what to do when an upload fails, a task needs review or a finished result misses the mark.',
    eyebrow: 'GANGNAM STYLE AI · COSTS AND TROUBLESHOOTING',
    datePublished: GANGNAM_BLOG_UPDATED,
    dateModified: GANGNAM_BLOG_UPDATED,
    intro: 'A Gangnam Style AI video costs **{standardCredits} credits at 480p** or **{hdCredits} credits at 720p**. Confirmed failed generations return the deducted credits to your account; that is different from a cash refund. If submission cannot be confirmed, the task needs support review and is not automatically sent again as another paid generation.',
    sections: [
      {
        id: 'what-the-quote-covers',
        title: 'What the displayed generation cost covers',
        blocks: [
          { type: 'p', text: 'The quote applies to one complete template generation, including preparation of the original reference soundtrack. Friends, Three of you and Pet trio use the same resolution-based price. One selfie therefore changes the upload requirement, not the credit cost of the finished scene.' },
          { type: 'p', text: 'Compare your current account or guest wallet balance with the quote in the [Gangnam Style studio](/gangnam-style-ai-video-generator#studio). Credit packs and subscriptions are listed on [Pricing](/pricing). Another photo or resolution means a separate generation, so decide what to change before submitting again.' },
        ],
      },
      {
        id: 'fix-upload-problems',
        title: 'Fix upload problems before starting a task',
        blocks: [
          { type: 'ul', items: [
            'Unsupported format: export a real JPEG, PNG or WebP file. Renaming an unsupported file does not convert its contents.',
            'File too large: reduce it below the 10 MB limit while preserving a clear face or pet reference.',
            'Missing photos: friends and pets require three uploads; Three of you requires one.',
            'Consent or account prompt: confirm permission for the photos, check the current account or guest wallet, and follow any sign-in prompt shown.',
          ] },
          { type: 'p', text: 'These checks happen before a new generation is reserved. If a photo is still rejected, export a fresh copy and check its crop rather than repeatedly renaming it. Use the [photo checklist](/gangnam-style-ai-video-generator/blog/best-photos-for-gangnam-style-ai-video) to catch unclear faces and accidental group pictures too.' },
        ],
      },
      {
        id: 'understand-status',
        title: 'Read the task status before trying again',
        blocks: [
          { type: 'p', text: 'A task can queue, generate the visuals, add the soundtrack and undergo review before delivery. There is no promised completion time. A task that is still processing is not the same as one confirmed as failed, and its unfinished video is not available for download.' },
          { type: 'p', text: 'If the page loses its connection, return to the same account or guest wallet and check the existing task. An unresolved submission may already have started. Keep the generation ID and displayed message; a missing preview does not mean nothing was submitted.' },
          { type: 'p', text: 'When the service cannot confirm a provider submission, it holds the request for support review instead of automatically paying to submit it again. Contact support with the generation ID if the task remains unresolved. Starting a separate new task does not resolve the first one.' },
        ],
      },
      {
        id: 'failed-versus-disappointing',
        title: 'Separate a failed job from a result you want to improve',
        blocks: [
          { type: 'p', text: 'A confirmed failure returns generation credits to the balance. A completed video with an imperfect likeness is different: AI results can vary, and dissatisfaction with a successful result does not by itself qualify for a refund under the site’s policy.' },
          { type: 'p', text: 'For an appearance problem, review the opening group, each solo and the closing group against the uploaded references. Check the Middle, Right and Left order. If one reference is blurry or obscured, replace that one in a future attempt. Choosing 720p alone does not guarantee better identity matching; see the [resolution guide](/gangnam-style-ai-video-generator/blog/gangnam-style-ai-video-format-resolution).' },
        ],
      },
      {
        id: 'credit-return-or-refund',
        title: 'Understand credit restoration and payment refunds',
        blocks: [
          { type: 'p', text: 'Returned generation credits stay in your MigosAI account. They are not a transfer back to your bank or card. If a confirmed failed task has not restored the expected balance, give support the generation ID so the task and credit records can be checked.' },
          { type: 'p', text: 'The [Refund Policy](/refund-policy) permits refund requests within 14 days for completely unused credit packs, subject to verifying the order and credit records. Subscription and payment issues require review. Approved payment refunds do not necessarily arrive in your bank account immediately.' },
        ],
      },
      {
        id: 'send-useful-details',
        title: 'Send support details that identify the problem',
        blocks: [
          { type: 'p', text: 'Include the generation ID, mode, resolution and exact status message for an unresolved task, plus an account email if applicable. For purchase issues, include the order ID and date. Explain whether you are reporting missing credits, a stuck task or a completed result’s appearance.' },
        ],
      },
    ],
    faqs: [
      { question: 'Will a failed video use up my credits?', answer: 'Credits deducted for a task confirmed as failed are returned to your balance. If the task is unresolved or the balance appears incorrect, contact support with its generation ID.' },
      { question: 'Does the service automatically make another paid attempt?', answer: 'No. Paid generation retries are not automatic. An uncertain provider submission is held for support review rather than submitted again automatically.' },
      { question: 'Can I get a refund because the face is not exact?', answer: 'A completed AI result can vary from the reference. Dissatisfaction alone does not qualify for a refund under the site’s stated policy; consult the refund page for its full terms and contact support about your specific issue.' },
      { question: 'Is a credit return the same as a card refund?', answer: 'No. A failed-generation credit return restores your site balance. A payment refund is a separate request involving the purchase records and the original payment method.' },
    ],
    sources: [
      { label: 'Gangnam Style studio: prices, task status and upload checks', url: '/gangnam-style-ai-video-generator#studio' },
      { label: 'MigosAI pricing: credit packs and subscriptions', url: '/pricing' },
      { label: 'Refund Policy: generation failures, unused packs and payment requests', url: '/refund-policy' },
    ],
  },
];
