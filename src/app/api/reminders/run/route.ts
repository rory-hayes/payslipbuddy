import { inMemoryDb } from "@/lib/db/in-memory-db";
import { ok } from "@/lib/http";
import { enqueueJob, processJob } from "@/lib/services/jobs";

export async function POST() {
  const users = inMemoryDb.listUsers().filter((user) => user.reminderEnabled);

  const results = await Promise.all(
    users.map(async (user) => {
      const job = enqueueJob("monthly_reminder", { userId: user.id, email: user.email });
      await processJob(job, async () => {
        // Placeholder: wire to transactional email provider (Resend/Postmark) in production.
        return { sent: true, to: user.email };
      });

      return { userId: user.id, email: user.email, jobId: job.id };
    })
  );

  return ok({
    sentCount: results.length,
    reminders: results
  });
}
