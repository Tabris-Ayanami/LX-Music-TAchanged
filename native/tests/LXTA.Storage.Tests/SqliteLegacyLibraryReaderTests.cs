using System.Security.Cryptography;
using LXTA.Application.Abstractions;
using LXTA.Storage.Legacy;
using Microsoft.Data.Sqlite;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace LXTA.Storage.Tests;

[TestClass]
public sealed class SqliteLegacyLibraryReaderTests
{
    [TestMethod]
    public async Task ReadAsync_LoadsOrderedLocalTracksWithoutChangingDatabase()
    {
        using var fixture = new DatabaseFixture();
        var hashBefore = SHA256.HashData(await File.ReadAllBytesAsync(fixture.Paths.LegacyDatabasePath));

        var snapshot = await new SqliteLegacyLibraryReader(fixture.Paths).ReadAsync();

        var hashAfter = SHA256.HashData(await File.ReadAllBytesAsync(fixture.Paths.LegacyDatabasePath));
        CollectionAssert.AreEqual(hashBefore, hashAfter);
        Assert.AreEqual(2, snapshot.Tracks.Count);
        Assert.AreEqual("First", snapshot.Tracks[0].Title);
        Assert.AreEqual("Album A", snapshot.Tracks[0].Album);
        Assert.AreEqual("Second", snapshot.Tracks[1].Title);
        Assert.IsFalse(File.Exists(fixture.Paths.LegacyDatabasePath + "-wal"));
        Assert.IsFalse(File.Exists(fixture.Paths.LegacyDatabasePath + "-shm"));
    }

    [TestMethod]
    public async Task ReadAsync_RejectsMissingSchemaWithoutCreatingFiles()
    {
        using var fixture = new DatabaseFixture(createSchema: false);

        await Assert.ThrowsExceptionAsync<LegacyLibraryException>(
            () => new SqliteLegacyLibraryReader(fixture.Paths).ReadAsync());
    }

    private sealed class DatabaseFixture : IDisposable
    {
        private readonly string root;

        public DatabaseFixture(bool createSchema = true)
        {
            root = Path.Combine(Path.GetTempPath(), "lxta-native-tests", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(root);
            Paths = new TestPaths(root);

            using var connection = new SqliteConnection(
                $"Data Source={Paths.LegacyDatabasePath};Pooling=False");
            connection.Open();
            if (!createSchema) return;

            using var command = connection.CreateCommand();
            command.CommandText = """
                CREATE TABLE my_list_music_info (
                    id TEXT NOT NULL,
                    listId TEXT NOT NULL,
                    name TEXT,
                    singer TEXT,
                    source TEXT,
                    interval TEXT,
                    meta TEXT
                );
                CREATE TABLE my_list_music_info_order (
                    listId TEXT NOT NULL,
                    musicInfoId TEXT NOT NULL,
                    "order" INTEGER NOT NULL
                );
                INSERT INTO my_list_music_info VALUES
                    ('two', 'userlist_local_music', 'Second', 'Artist B', 'local', '04:02', '{"albumName":"Album B","filePath":"Z:\\missing-two.flac","ext":"flac"}'),
                    ('one', 'userlist_local_music', 'First', 'Artist A', 'local', '03:01', '{"albumName":"Album A","filePath":"Z:\\missing-one.flac","ext":"flac"}'),
                    ('online', 'userlist_local_music', 'Online', 'Artist', 'wy', '02:00', '{}');
                INSERT INTO my_list_music_info_order VALUES
                    ('userlist_local_music', 'one', 0),
                    ('userlist_local_music', 'two', 1);
                """;
            command.ExecuteNonQuery();
        }

        public TestPaths Paths { get; }

        public void Dispose()
        {
            if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
        }
    }

    private sealed class TestPaths(string root) : IAppPaths
    {
        public string LegacyDatabasePath { get; } = Path.Combine(root, "fixture.db");

        public string NativeDataRoot { get; } = Path.Combine(root, "native");

        public string ArtworkCacheRoot { get; } = Path.Combine(root, "native", "artwork");
    }
}
