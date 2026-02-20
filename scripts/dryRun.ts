import { selectCandidateForPost, generateUtmUrl } from '../src/modules/selector';
import { checkDuplicate } from '../src/modules/duplicateGuard';
import { generateTextVariant, TemplateOptions } from '../src/modules/creativeEngine';
import { isCircuitOpen } from '../src/lib/circuitBreaker';

async function runDryRun() {
    console.log('--- STARTING DRY RUN ---');

    if (isCircuitOpen()) {
        console.log('Circuit is open or global kill switch is on. Aborting.');
        return;
    }

    // 1. Selection
    console.log('Selecting candidate...');
    const candidate = await selectCandidateForPost();

    if (!candidate) {
        console.log('No eligible candidates found for posting.');
        return;
    }

    console.log(`Selected Candidate: [${candidate.id}] ${candidate.title}`);

    // 2. Creative Generation
    const options: TemplateOptions = {
        title: candidate.title,
        category: candidate.category || 'General',
        tags: candidate.tags,
    };

    const textVariant = await generateTextVariant(options);
    console.log(`Generated Text: "${textVariant}"`);

    // 3. Duplicate Guard
    console.log('Checking duplicates...');
    // Note: we can't test actual duplicates robustly if DB is empty, but we can verify the function runs.
    const isDuplicate = await checkDuplicate(textVariant, candidate.thumbnailUrl || undefined);

    if (isDuplicate) {
        console.log('Candidate rejected by duplicate guard.');
        return;
    }

    console.log('Passed duplicate guard.');

    // 4. UTM Generation
    const utmUrl = generateUtmUrl(
        candidate.url,
        'agentx_daily',
        candidate.id,
        candidate.category || 'none'
    );
    console.log(`Generated UTM Link: ${utmUrl}`);

    console.log(`Final Mock Post Content:\n${textVariant}\n${utmUrl}`);
    console.log('--- DRY RUN COMPLETE ---');
}

runDryRun().catch(console.error).finally(() => process.exit(0));
