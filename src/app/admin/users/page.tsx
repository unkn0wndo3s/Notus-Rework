import { UserService } from "@/lib/services/UserService";
import UsersTable from "@/components/admin/UsersTable";

export default async function AdminUsersPage() {
  const userService = new UserService();
  const usersResult = await userService.getAllUsers(100, 0);
  const users = usersResult.success ? (usersResult.users || []) : [];

  return (
    <main className="space-y-6">
      <header className="text-center pt-10">
        <h1 className="text-3xl font-bold text-foreground">
          User Management
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage user accounts, ban or unban users.
        </p>
      </header>

      <section className="bg-background shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg leading-6 font-medium text-foreground">
              User List ({users.length})
            </h3>
            {/* <div className="flex space-x-2">
              <button className="inline-flex items-center px-3 py-2 border border-border shadow-sm text-sm leading-4 font-medium rounded-md text-foreground bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z"
                  />
                </svg>
                Filtrer
              </button>
              <button className="inline-flex items-center px-3 py-2 border border-border shadow-sm text-sm leading-4 font-medium rounded-md text-foreground bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Exporter
              </button>
            </div> */}
          </div>

          <UsersTable users={users} />
        </div>
      </section>
    </main>
  );
}

